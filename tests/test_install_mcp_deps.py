import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("CLAUDE_PROJECT_DIR", str(REPOSITORY_ROOT))
MODULE_PATH = REPOSITORY_ROOT / "hooks" / "install-mcp-deps.py"
SPEC = importlib.util.spec_from_file_location("install_mcp_deps", MODULE_PATH)
INSTALL_MCP_DEPS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INSTALL_MCP_DEPS)

SATELLITE_MODULE_PATH = REPOSITORY_ROOT / "hooks" / "satellite-detection.py"
SATELLITE_SPEC = importlib.util.spec_from_file_location(
    "satellite_detection", SATELLITE_MODULE_PATH
)
SATELLITE_DETECTION = importlib.util.module_from_spec(SATELLITE_SPEC)
SATELLITE_SPEC.loader.exec_module(SATELLITE_DETECTION)

PULSE_MODULE_PATH = REPOSITORY_ROOT / "hooks" / "base-pulse-check.py"
PULSE_SPEC = importlib.util.spec_from_file_location(
    "base_pulse_check", PULSE_MODULE_PATH
)
BASE_PULSE_CHECK = importlib.util.module_from_spec(PULSE_SPEC)
PULSE_SPEC.loader.exec_module(BASE_PULSE_CHECK)


class DependencyDetectionTests(unittest.TestCase):
    def test_requires_every_declared_runtime_dependency(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            package_path = root / "package.json"
            package_path.write_text(json.dumps({
                "dependencies": {
                    "@modelcontextprotocol/sdk": "^1.0.0",
                    "@iarna/toml": "^2.2.5",
                },
            }), encoding="utf-8")

            (root / "node_modules" / "@modelcontextprotocol" / "sdk").mkdir(parents=True)
            self.assertFalse(
                INSTALL_MCP_DEPS.dependencies_installed(package_path, root)
            )

            (root / "node_modules" / "@iarna" / "toml").mkdir(parents=True)
            self.assertTrue(
                INSTALL_MCP_DEPS.dependencies_installed(package_path, root)
            )

    def test_invalid_package_manifest_is_not_treated_as_installed(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            package_path = root / "package.json"
            package_path.write_text("not-json", encoding="utf-8")
            self.assertFalse(
                INSTALL_MCP_DEPS.dependencies_installed(package_path, root)
            )


class SatelliteStateTests(unittest.TestCase):
    def test_prefers_and_normalizes_paul_toml(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            paul_directory = root / ".paul"
            paul_directory.mkdir()
            (paul_directory / "paul.toml").write_text(
                """
name = "pact"

[milestone]
name = "M-HARDEN-0722"
phases = 1

[phase]
number = 119
name = "QUALITY-codebase-hardening"
status = "in_progress"

[loop]
position = "APPLY"

[stats]
total_phases = 395
last_activity = "2026-07-29T09:41:02Z"

[satellite]
groom = false
""".strip(),
                encoding="utf-8",
            )
            (paul_directory / "paul.json").write_text(
                json.dumps({"name": "stale-json"}), encoding="utf-8"
            )

            state_files = SATELLITE_DETECTION.find_paul_state_files(root)
            self.assertEqual(state_files, [paul_directory / "paul.toml"])
            paul_data = SATELLITE_DETECTION.read_paul_state(state_files[0])
            self.assertEqual(paul_data["name"], "pact")
            self.assertEqual(paul_data["phase"]["total"], 1)
            self.assertEqual(
                paul_data["timestamps"]["updated_at"],
                "2026-07-29T09:41:02Z",
            )
            paul_field = SATELLITE_DETECTION.build_paul_field(
                paul_data, "pact", "."
            )
            self.assertEqual(paul_field["location"], "./")
            self.assertIsNone(paul_field["completed_phases"])
            self.assertEqual(paul_field["total_phases"], 1)
            self.assertFalse(paul_data["satellite"]["groom"])

    def test_invalid_toml_satellite_does_not_abort_later_valid_satellite(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            base_directory = root / ".base"
            (base_directory / "data").mkdir(parents=True)
            (base_directory / "workspace.json").write_text(
                json.dumps({"satellites": {}}), encoding="utf-8"
            )
            (base_directory / "data" / "projects.json").write_text(
                json.dumps({"items": []}), encoding="utf-8"
            )

            bad_paul = root / "a-bad" / ".paul"
            bad_paul.mkdir(parents=True)
            (bad_paul / "paul.toml").write_text(
                'name = "bad"\nphase = "not-a-table"\n', encoding="utf-8"
            )

            bad_name_paul = root / "b-bad-name" / ".paul"
            bad_name_paul.mkdir(parents=True)
            (bad_name_paul / "paul.toml").write_text(
                'name = ["not", "a", "string"]\n', encoding="utf-8"
            )

            good_paul = root / "z-good" / ".paul"
            good_paul.mkdir(parents=True)
            (good_paul / "paul.toml").write_text(
                'name = "good"\n[milestone]\nphases = 2\n[satellite]\ngroom = false\n',
                encoding="utf-8",
            )

            environment = os.environ.copy()
            environment["CLAUDE_PROJECT_DIR"] = str(root)
            python_executable = shutil.which("python3.11") or sys.executable
            result = subprocess.run(
                [python_executable, str(SATELLITE_MODULE_PATH)],
                capture_output=True,
                text=True,
                timeout=10,
                env=environment,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads(
                (base_directory / "workspace.json").read_text(encoding="utf-8")
            )
            self.assertNotIn("bad", manifest["satellites"])
            self.assertNotIn("b-bad-name", manifest["satellites"])
            self.assertIn("good", manifest["satellites"])
            self.assertFalse(manifest["satellites"]["good"]["groom_check"])

    def test_modern_toml_does_not_erase_legacy_only_workspace_fields(self):
        satellites = {
            "pact": {
                "handoff": True,
                "last_plan_completed_at": "2026-07-01T00:00:00Z",
                "next_action": "Preserve me",
                "groom_check": True,
            }
        }
        paul_data = {
            "phase": {"name": "Apply", "number": 2, "status": "in_progress"},
            "loop": {"position": "APPLY"},
            "handoff": {},
            "satellite": {"groom": False},
        }

        self.assertTrue(
            SATELLITE_DETECTION.sync_to_workspace(satellites, paul_data, "pact")
        )
        self.assertTrue(satellites["pact"]["handoff"])
        self.assertEqual(
            satellites["pact"]["last_plan_completed_at"],
            "2026-07-01T00:00:00Z",
        )
        self.assertEqual(satellites["pact"]["next_action"], "Preserve me")
        self.assertFalse(satellites["pact"]["groom_check"])

    def test_falls_back_to_legacy_paul_json(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            paul_directory = root / "apps" / "legacy" / ".paul"
            paul_directory.mkdir(parents=True)
            legacy_data = {
                "name": "legacy",
                "phase": {
                    "number": 3,
                    "name": "Ship",
                    "status": "complete",
                    "total": 7,
                },
                "timestamps": {"updated_at": "2026-06-01T10:00:00Z"},
            }
            (paul_directory / "paul.json").write_text(
                json.dumps(legacy_data), encoding="utf-8"
            )

            state_files = SATELLITE_DETECTION.find_paul_state_files(root)
            self.assertEqual(state_files, [paul_directory / "paul.json"])
            self.assertEqual(
                SATELLITE_DETECTION.read_paul_state(state_files[0]),
                legacy_data,
            )


class PulseStateTests(unittest.TestCase):
    def test_stale_satellite_check_prefers_paul_toml(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            paul_directory = root / ".paul"
            paul_directory.mkdir()
            (paul_directory / "paul.toml").write_text(
                """
name = "pact"

[stats]
last_activity = "2020-01-01T00:00:00Z"
""".strip(),
                encoding="utf-8",
            )
            (paul_directory / "paul.json").write_text(
                json.dumps({
                    "name": "stale-json",
                    "timestamps": {"updated_at": "2099-01-01T00:00:00Z"},
                }),
                encoding="utf-8",
            )

            BASE_PULSE_CHECK.WORKSPACE_ROOT = root
            BASE_PULSE_CHECK.STATE_FILE = root / ".base" / "data" / "state.json"
            BASE_PULSE_CHECK.PROJECTS_FILE = root / ".base" / "data" / "projects.json"
            BASE_PULSE_CHECK.STATE_FILE.parent.mkdir(parents=True)
            state = {"satellites": {"pact": {"path": "."}}}

            result = BASE_PULSE_CHECK.recalculate_drift(state)
            self.assertEqual(result["drift"]["indicators"]["stale_satellites"], 1)

    def test_malformed_toml_satellite_does_not_abort_pulse(self):
        malformed_documents = (
            'name = "pact"\nstats = "not-a-table"\n',
            'name = "pact"\n[stats]\nlast_activity = 123\n',
        )
        for document in malformed_documents:
            with self.subTest(document=document), tempfile.TemporaryDirectory() as temporary_directory:
                root = Path(temporary_directory)
                paul_directory = root / ".paul"
                paul_directory.mkdir()
                (paul_directory / "paul.toml").write_text(
                    document, encoding="utf-8"
                )

                BASE_PULSE_CHECK.WORKSPACE_ROOT = root
                BASE_PULSE_CHECK.STATE_FILE = root / ".base" / "data" / "state.json"
                BASE_PULSE_CHECK.PROJECTS_FILE = (
                    root / ".base" / "data" / "projects.json"
                )
                BASE_PULSE_CHECK.STATE_FILE.parent.mkdir(parents=True)
                state = {"satellites": {"pact": {"path": "."}}}

                result = BASE_PULSE_CHECK.recalculate_drift(state)
                self.assertEqual(
                    result["drift"]["indicators"]["stale_satellites"], 0
                )


if __name__ == "__main__":
    unittest.main()
