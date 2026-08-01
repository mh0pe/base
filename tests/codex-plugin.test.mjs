import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
