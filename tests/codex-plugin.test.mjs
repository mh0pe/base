import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const manifestPath = path.join(
  repositoryRoot,
  ".codex-plugin",
  "plugin.json",
);

test("Codex manifest uses a plugin-relative MCP launch", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const server = manifest.mcpServers["base-mcp"];

  assert.deepEqual(server.args, ["mcp/codex-launch.js"]);
  assert.equal(server.cwd, ".");
  assert.deepEqual(server.env_vars, ["CLAUDE_PROJECT_DIR", "PWD"]);
  assert.doesNotMatch(JSON.stringify(server), /\$\{CLAUDE_PLUGIN_ROOT\}/);
});

test("package manifests advertise the installed MCP runtime floor", async () => {
  const rootPackage = JSON.parse(
    await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
  );
  const mcpPackage = JSON.parse(
    await readFile(path.join(repositoryRoot, "mcp", "package.json"), "utf8"),
  );
  assert.equal(rootPackage.engines.node, ">=20");
  assert.equal(mcpPackage.engines.node, ">=20");
});

test("npm package excludes local dependency and bytecode artifacts", async () => {
  const { stdout } = await execFileAsync(
    "npm",
    ["pack", "--dry-run", "--json"],
    { cwd: repositoryRoot },
  );
  const [packed] = JSON.parse(stdout);
  const files = packed.files.map((entry) => entry.path);

  assert.equal(files.some((file) => file.includes("node_modules")), false);
  assert.equal(files.some((file) => file.includes("__pycache__")), false);
  assert.equal(files.some((file) => file.endsWith(".pyc")), false);
  assert.ok(files.includes("mcp/package-lock.json"));
  assert.ok(files.includes("mcp/tools/satellite.js"));
  assert.ok(files.includes("hooks/install-mcp-deps.py"));
});

test("skills-dir install preserves the committed hook runtime manifest", async (t) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "base-skills-install-"));
  const target = path.join(temporaryRoot, "base");
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));

  await execFileAsync(process.execPath, [
    path.join(repositoryRoot, "bin", "install.js"),
    "--skills-dir",
    "--dir",
    target,
  ]);

  const sourceHooks = JSON.parse(
    await readFile(path.join(repositoryRoot, "hooks", "hooks.json"), "utf8"),
  );
  const installedHooks = JSON.parse(
    await readFile(path.join(target, "hooks", "hooks.json"), "utf8"),
  );
  assert.deepEqual(installedHooks, sourceHooks);
  const commands = Object.values(installedHooks.hooks)
    .flat()
    .flatMap((group) => group.hooks)
    .map((hook) => hook.command);
  assert.ok(commands.length > 0);
  assert.ok(commands.every((command) => command.startsWith("python3 -I ")));
  await assert.rejects(access(path.join(target, "mcp", "node_modules")));
});

test("Codex launcher initializes BASE and exposes all tools", async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "base-codex-workspace-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const server = manifest.mcpServers["base-mcp"];
  const child = spawn(server.command, server.args, {
    cwd: repositoryRoot,
    env: {
      HOME: os.homedir(),
      PATH: process.env.PATH,
      PWD: workspace,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  t.after(() => child.kill());

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "base-codex-test", version: "1.0.0" },
    },
  })}\n`);
  child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  })}\n`);

  const deadline = Date.now() + 10_000;
  while (!stdout.includes('"id":2') && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  assert.match(stdout, /"id":1/);
  const toolsLine = stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .find((message) => message.id === 2);
  assert.ok(toolsLine, `missing tools/list response; stderr:\n${stderr}`);
  assert.equal(toolsLine.result.tools.length, 22);
  assert.match(stderr, new RegExp(`Workspace: ${workspace.replaceAll("\\", "\\\\")}`));
});
