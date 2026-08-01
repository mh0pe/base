#!/usr/bin/env python3
"""
SessionStart hook: install base-mcp npm dependencies into CLAUDE_PLUGIN_DATA.

Idempotent: exits 0 immediately if every declared MCP dependency is present.
Fail-open: warns to stderr and exits 0 on any error so the session always starts.

Strategy:
  1. npm ci --omit=dev --prefix "$CLAUDE_PLUGIN_DATA" when the release ships
     a lockfile; otherwise fall back to npm install.
     -> places node_modules at $CLAUDE_PLUGIN_DATA/node_modules/
  2. symlink $CLAUDE_PLUGIN_ROOT/mcp/node_modules
             -> $CLAUDE_PLUGIN_DATA/node_modules
     Node ESM resolves bare specifiers by walking up from the importing file, so
     node_modules must live adjacent to index.js. NODE_PATH is honored only by
     the CommonJS loader (node:internal/modules/cjs), not the ESM loader; this
     symlink bridges the two locations so ESM resolution succeeds.
     The MCP server lives at ${CLAUDE_PLUGIN_ROOT}/mcp/index.js, so the symlink
     target is ${CLAUDE_PLUGIN_ROOT}/mcp/node_modules.
"""
import os
import sys
import shutil
import subprocess
import json


MCP_RUNTIME_IMPORTS = (
    "@iarna/toml",
    "@modelcontextprotocol/sdk/server/index.js",
    "@modelcontextprotocol/sdk/server/stdio.js",
    "@modelcontextprotocol/sdk/types.js",
)


def warn(msg):
    print(f"[install-mcp-deps] WARNING: {msg}", file=sys.stderr)


def dependencies_installed(package_json_path, plugin_data):
    """Return True only when every dependency declared by the MCP is installed."""
    try:
        with open(package_json_path, encoding="utf-8") as handle:
            package_manifest = json.load(handle)
        if not isinstance(package_manifest, dict):
            return False
        dependencies = package_manifest.get("dependencies", {})
        if not isinstance(dependencies, dict):
            return False
    except (OSError, json.JSONDecodeError, TypeError):
        return False

    expected_versions = {}
    lockfile_path = os.path.join(os.path.dirname(package_json_path), "package-lock.json")
    if os.path.isfile(lockfile_path):
        try:
            with open(lockfile_path, encoding="utf-8") as handle:
                lockfile = json.load(handle)
            locked_packages = lockfile.get("packages", {})
            if not isinstance(locked_packages, dict):
                return False
            for name in dependencies:
                locked_package = locked_packages.get(f"node_modules/{name}", {})
                locked_version = locked_package.get("version")
                if not isinstance(locked_version, str) or not locked_version:
                    return False
                expected_versions[name] = locked_version
        except (OSError, json.JSONDecodeError, TypeError, AttributeError):
            return False

    node_modules = os.path.join(plugin_data, "node_modules")
    for name in dependencies:
        if not isinstance(name, str) or not name:
            return False
        installed_manifest = os.path.join(
            node_modules, *name.split("/"), "package.json"
        )
        try:
            with open(installed_manifest, encoding="utf-8") as handle:
                installed_package = json.load(handle)
            if (
                not isinstance(installed_package, dict)
                or installed_package.get("name") != name
                or not isinstance(installed_package.get("version"), str)
                or not installed_package["version"]
                or (
                    name in expected_versions
                    and installed_package["version"] != expected_versions[name]
                )
            ):
                return False
        except (OSError, json.JSONDecodeError, TypeError):
            return False

    # Package metadata alone can survive a truncated install. Resolve and load
    # the exact bare imports used by the MCP so missing files or transitives
    # (for example zod behind the SDK) trigger a repair install.
    node = shutil.which("node")
    if not node:
        return False
    probe = "\n".join(
        f"await import({json.dumps(specifier)});"
        for specifier in MCP_RUNTIME_IMPORTS
    )
    try:
        result = subprocess.run(
            [node, "--input-type=module", "--eval", probe],
            cwd=plugin_data,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    return result.returncode == 0


def main():
    plugin_root = os.environ.get("CLAUDE_PLUGIN_ROOT", "").strip()
    plugin_data = os.environ.get("CLAUDE_PLUGIN_DATA", "").strip()

    if not plugin_data:
        warn("CLAUDE_PLUGIN_DATA is not set; skipping MCP deps install.")
        sys.exit(0)

    if not plugin_root:
        warn("CLAUDE_PLUGIN_ROOT is not set; skipping MCP deps install.")
        sys.exit(0)

    # MCP server lives at ${CLAUDE_PLUGIN_ROOT}/mcp/index.js — symlink goes next to it
    mcp_dir = os.path.join(plugin_root, "mcp")
    mcp_nm = os.path.join(mcp_dir, "node_modules")

    # Source package.json is at ${CLAUDE_PLUGIN_ROOT}/mcp/package.json
    src_pkg = os.path.join(mcp_dir, "package.json")
    if not os.path.isfile(src_pkg):
        warn(f"package.json not found at {src_pkg}; skipping.")
        sys.exit(0)

    # Re-run npm install when a release adds any dependency. Checking only the
    # SDK marker left upgraded plugin data missing newer runtime packages.
    if dependencies_installed(src_pkg, plugin_data):
        # Re-assert symlink so it survives if the plugin dir was refreshed
        _assert_symlink(mcp_nm, plugin_data, src_pkg)
        sys.exit(0)

    try:
        os.makedirs(plugin_data, exist_ok=True)
        shutil.copy2(src_pkg, os.path.join(plugin_data, "package.json"))

        lockfile = os.path.join(mcp_dir, "package-lock.json")
        has_lockfile = os.path.isfile(lockfile)
        if has_lockfile:
            shutil.copy2(lockfile, os.path.join(plugin_data, "package-lock.json"))

        npm = shutil.which("npm")
        if not npm:
            warn("npm not found in PATH; skipping MCP deps install.")
            sys.exit(0)

        install_mode = "ci" if has_lockfile else "install"
        result = subprocess.run(
            [
                npm,
                install_mode,
                "--omit=dev",
                "--prefix",
                plugin_data,
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            warn(
                f"npm {install_mode} failed (exit {result.returncode}): "
                f"{result.stderr.strip()}"
            )
            sys.exit(0)

        _assert_symlink(mcp_nm, plugin_data, src_pkg)
        print(f"[install-mcp-deps] MCP deps installed to {plugin_data}", file=sys.stderr)

    except Exception as exc:
        warn(f"Unexpected error during MCP deps install: {exc}")
        sys.exit(0)


def _assert_symlink(link_path, plugin_data, package_json_path=None):
    """Create or update the node_modules symlink inside the MCP dir."""
    target = os.path.join(plugin_data, "node_modules")
    try:
        # Remove stale symlink so we can set the correct target
        if os.path.islink(link_path):
            if os.readlink(link_path) == target:
                return  # already correct
            os.unlink(link_path)
        elif os.path.isdir(link_path):
            # Preserve a complete local development install. Replace only an
            # incomplete managed dependency tree, which would otherwise take
            # precedence over the freshly installed plugin-data packages.
            mcp_dir = os.path.dirname(link_path)
            if package_json_path and dependencies_installed(
                package_json_path, mcp_dir
            ):
                return
            shutil.rmtree(link_path)
        os.symlink(target, link_path)
    except Exception as exc:
        print(
            f"[install-mcp-deps] WARNING: could not assert symlink {link_path} -> {target}: {exc}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
