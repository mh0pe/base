import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { handleTool as handleSatellite } from "../mcp/tools/satellite.js";
import { handleTool as handleState } from "../mcp/tools/state.js";

async function makeWorkspace(t) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "base-mcp-tools-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await mkdir(path.join(workspace, ".base", "data"), { recursive: true });
  return workspace;
}

async function writeJson(filepath, value) {
  await mkdir(path.dirname(filepath), { recursive: true });
  await writeFile(filepath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(filepath) {
  return JSON.parse(await readFile(filepath, "utf8"));
}

function projectFixture(overrides = {}) {
  return {
    id: "PRJ-001",
    title: "pact",
    type: "project",
    parent_id: null,
    status: "in_progress",
    priority: "medium",
    category: "internal",
    assignees: [],
    start_date: null,
    due_date: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    location: "./",
    blocked_by: null,
    next: null,
    notes: [],
    tags: [],
    paul: {
      satellite_name: "pact",
      preserved: true,
      handoff: true,
      handoff_path: ".paul/HANDOFF.md",
      last_plan_completed_at: "2026-07-01T00:00:00Z",
    },
    relations: [],
    description: null,
    ...overrides,
  };
}

test("base_sync_satellite prefers paul.toml and maps current PAUL fields", async (t) => {
  const workspace = await makeWorkspace(t);
  await writeJson(path.join(workspace, ".base", "workspace.json"), {
    satellites: {
      pact: {
        path: ".",
        engine: "paul",
        preserved: true,
        groom_check: true,
        handoff: true,
        last_plan_completed_at: "2026-07-01T00:00:00Z",
      },
    },
  });
  await writeJson(path.join(workspace, ".base", "data", "projects.json"), {
    version: 1,
    last_modified: null,
    items: [projectFixture()],
  });
  await mkdir(path.join(workspace, ".paul"), { recursive: true });
  await writeFile(path.join(workspace, ".paul", "paul.toml"), `
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
`, "utf8");
  await writeJson(path.join(workspace, ".paul", "paul.json"), {
    name: "stale-json",
    phase: { number: 1, name: "stale", status: "complete", total: 1 },
  });

  const result = handleSatellite("base_sync_satellite", { path: "." }, workspace);

  assert.deepEqual(result, {
    satellite: "pact",
    workspace_synced: true,
    project_synced: true,
    project_created: false,
  });
  const manifest = await readJson(path.join(workspace, ".base", "workspace.json"));
  assert.deepEqual(manifest.satellites.pact, {
    path: ".",
    engine: "paul",
    preserved: true,
    groom_check: false,
    last_activity: "2026-07-29T09:41:02Z",
    phase_name: "QUALITY-codebase-hardening",
    phase_number: 119,
    phase_status: "in_progress",
    loop_position: "APPLY",
    handoff: true,
    last_plan_completed_at: "2026-07-01T00:00:00Z",
  });
  const projects = await readJson(path.join(workspace, ".base", "data", "projects.json"));
  assert.equal(projects.items[0].paul.preserved, true);
  assert.equal(projects.items[0].paul.milestone, "M-HARDEN-0722");
  assert.equal(projects.items[0].paul.phase, "QUALITY-codebase-hardening");
  assert.equal(projects.items[0].paul.completed_phases, null);
  assert.equal(projects.items[0].paul.total_phases, 1);
  assert.equal(projects.items[0].paul.last_update, "2026-07-29T09:41:02Z");
  assert.equal(projects.items[0].paul.location, "./");
  assert.equal(projects.items[0].paul.handoff, true);
  assert.equal(projects.items[0].paul.handoff_path, ".paul/HANDOFF.md");
  assert.equal(
    projects.items[0].paul.last_plan_completed_at,
    "2026-07-01T00:00:00Z",
  );
});

test("base_sync_satellite preserves a zero current-milestone phase total", async (t) => {
  const workspace = await makeWorkspace(t);
  await writeJson(path.join(workspace, ".base", "workspace.json"), { satellites: {} });
  await writeJson(path.join(workspace, ".base", "data", "projects.json"), {
    version: 1,
    last_modified: null,
    items: [],
  });
  await mkdir(path.join(workspace, ".paul"), { recursive: true });
  await writeFile(path.join(workspace, ".paul", "paul.toml"), `
name = "pact"
[milestone]
phases = 0
[phase]
number = 0
name = "None"
status = "not_started"
`, "utf8");

  handleSatellite("base_sync_satellite", { path: "." }, workspace);

  const projects = await readJson(path.join(workspace, ".base", "data", "projects.json"));
  assert.equal(projects.items[0].paul.total_phases, 0);
});

test("base_sync_satellite falls back to legacy paul.json", async (t) => {
  const workspace = await makeWorkspace(t);
  await writeJson(path.join(workspace, ".base", "workspace.json"), { satellites: {} });
  await writeJson(path.join(workspace, ".base", "data", "projects.json"), {
    version: 1,
    last_modified: null,
    items: [],
  });
  await writeJson(path.join(workspace, "apps", "legacy", ".paul", "paul.json"), {
    name: "legacy",
    project: { title: "Legacy project" },
    milestone: { name: "M1" },
    phase: { number: 3, name: "Ship", status: "complete", total: 7 },
    loop: { position: "UNIFY" },
    handoff: { present: true, path: ".paul/HANDOFF.md" },
    timestamps: { updated_at: "2026-06-01T10:00:00Z" },
  });

  const result = handleSatellite(
    "base_sync_satellite",
    { path: "apps/legacy" },
    workspace,
  );

  assert.equal(result.satellite, "legacy");
  assert.equal(result.workspace_synced, true);
  assert.equal(result.project_created, true);
  const projects = await readJson(path.join(workspace, ".base", "data", "projects.json"));
  assert.equal(projects.items[0].title, "Legacy project");
  assert.equal(projects.items[0].location, "apps/legacy/");
  assert.equal(projects.items[0].paul.completed_phases, 3);
  assert.equal(projects.items[0].paul.total_phases, 7);
  assert.equal(projects.items[0].paul.handoff, true);
});

test("base_sync_satellite reports both supported filenames when state is absent", async (t) => {
  const workspace = await makeWorkspace(t);
  assert.throws(
    () => handleSatellite("base_sync_satellite", { path: "apps/missing" }, workspace),
    /No paul\.toml or paul\.json found/,
  );
});

test("base_sync_satellite rejects malformed table shapes before writes", async (t) => {
  const workspace = await makeWorkspace(t);
  const manifestPath = path.join(workspace, ".base", "workspace.json");
  const projectsPath = path.join(workspace, ".base", "data", "projects.json");
  await writeJson(manifestPath, { satellites: { preserved: { path: "." } } });
  await writeJson(projectsPath, { version: 1, last_modified: null, items: [] });
  await mkdir(path.join(workspace, ".paul"), { recursive: true });
  await writeFile(
    path.join(workspace, ".paul", "paul.toml"),
    'name = "pact"\nphase = "not-a-table"\n',
    "utf8",
  );
  const manifestBefore = await readFile(manifestPath, "utf8");
  const projectsBefore = await readFile(projectsPath, "utf8");

  assert.throws(
    () => handleSatellite("base_sync_satellite", { path: "." }, workspace),
    /phase must be a table\/object/,
  );
  assert.equal(await readFile(manifestPath, "utf8"), manifestBefore);
  assert.equal(await readFile(projectsPath, "utf8"), projectsBefore);

  await writeFile(
    path.join(workspace, ".paul", "paul.toml"),
    'name = ["not", "a", "string"]\n',
    "utf8",
  );
  assert.throws(
    () => handleSatellite("base_sync_satellite", { path: "." }, workspace),
    /name must be a non-empty string/,
  );
  assert.equal(await readFile(manifestPath, "utf8"), manifestBefore);
  assert.equal(await readFile(projectsPath, "utf8"), projectsBefore);
});

test("base_record_carl_hygiene updates only targeted state in both BASE files", async (t) => {
  const workspace = await makeWorkspace(t);
  await writeJson(path.join(workspace, ".base", "workspace.json"), {
    name: "test",
    carl_hygiene: {
      proactive: true,
      cadence: "monthly",
      staleness_threshold_days: 60,
      max_rules_per_domain: 15,
      last_run: "2026-06-01",
    },
    preserved: { workspace: true },
  });
  await writeJson(path.join(workspace, ".base", "data", "state.json"), {
    version: 1,
    workspace: "test",
    last_modified: "2026-06-01T00:00:00Z",
    groom: { cadence: "weekly", day: "friday", last_groom: "2026-07-24" },
    drift: { score: 3, indicators: { active_age_days: 3 } },
    areas: {},
    satellites: {},
    preserved: { state: true },
  });

  const result = handleState("base_record_carl_hygiene", {
    date: "2026-08-01",
    summary: "  Reviewed 8 domains; resolved conflicting delegation rules.  ",
  }, workspace);

  assert.deepEqual(result, {
    last_run: "2026-08-01",
    summary: "Reviewed 8 domains; resolved conflicting delegation rules.",
  });
  const manifest = await readJson(path.join(workspace, ".base", "workspace.json"));
  assert.equal(manifest.carl_hygiene.last_run, "2026-08-01");
  assert.deepEqual(manifest.preserved, { workspace: true });

  const state = await readJson(path.join(workspace, ".base", "data", "state.json"));
  assert.equal(state.groom.last_carl_hygiene, "2026-08-01");
  assert.equal(
    state.groom.carl_hygiene_note,
    "Reviewed 8 domains; resolved conflicting delegation rules.",
  );
  assert.equal(state.carl_hygiene.last_run, "2026-08-01");
  assert.equal(state.carl_hygiene.cadence, "monthly");
  assert.deepEqual(state.preserved, { state: true });
  assert.deepEqual(state.drift, { score: 3, indicators: { active_age_days: 3 } });
});

test("base_record_carl_hygiene validates before mutating either file", async (t) => {
  const workspace = await makeWorkspace(t);
  const manifestPath = path.join(workspace, ".base", "workspace.json");
  const statePath = path.join(workspace, ".base", "data", "state.json");
  await writeJson(manifestPath, { carl_hygiene: { last_run: null }, preserved: true });
  await writeJson(statePath, { groom: {}, preserved: true });
  const beforeManifest = await readFile(manifestPath, "utf8");
  const beforeState = await readFile(statePath, "utf8");

  assert.throws(
    () => handleState("base_record_carl_hygiene", {
      date: "2026-02-30",
      summary: "should not be written",
    }, workspace),
    /valid YYYY-MM-DD calendar date/,
  );
  assert.equal(await readFile(manifestPath, "utf8"), beforeManifest);
  assert.equal(await readFile(statePath, "utf8"), beforeState);

  await writeJson(statePath, { groom: [], preserved: true });
  const malformedState = await readFile(statePath, "utf8");
  assert.throws(
    () => handleState("base_record_carl_hygiene", {
      date: "2026-08-01",
      summary: "should also not be written",
    }, workspace),
    /state\.json groom field must be an object/,
  );
  assert.equal(await readFile(manifestPath, "utf8"), beforeManifest);
  assert.equal(await readFile(statePath, "utf8"), malformedState);
});

test("base_record_carl_hygiene does not leave a one-sided record on write failure", async (t) => {
  const workspace = await makeWorkspace(t);
  const basePath = path.join(workspace, ".base");
  const manifestPath = path.join(basePath, "workspace.json");
  const statePath = path.join(basePath, "data", "state.json");
  await writeJson(manifestPath, { carl_hygiene: { last_run: null }, preserved: true });
  await writeJson(statePath, { groom: {}, preserved: true });
  const beforeManifest = await readFile(manifestPath, "utf8");
  const beforeState = await readFile(statePath, "utf8");

  // state.json's directory remains writable while workspace.json cannot be
  // replaced. The former implementation updated state.json before failing on
  // workspace.json, leaving the two last-run markers inconsistent.
  await chmod(manifestPath, 0o444);
  await chmod(basePath, 0o555);
  try {
    assert.throws(
      () => handleState("base_record_carl_hygiene", {
        date: "2026-08-01",
        summary: "must remain all-or-nothing",
      }, workspace),
      /EACCES|permission denied/,
    );
  } finally {
    await chmod(basePath, 0o755);
    await chmod(manifestPath, 0o644);
  }

  assert.equal(await readFile(manifestPath, "utf8"), beforeManifest);
  assert.equal(await readFile(statePath, "utf8"), beforeState);
});
