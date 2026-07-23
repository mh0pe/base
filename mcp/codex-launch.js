#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = (
  process.env.CLAUDE_PROJECT_DIR
  || process.env.PWD
  || ""
).trim();

if (!workspace) {
  throw new Error(
    "[BASE] Codex did not provide a project directory. "
      + "Launch Codex from the project root or set CLAUDE_PROJECT_DIR.",
  );
}

process.env.CLAUDE_PROJECT_DIR = path.resolve(workspace);
process.chdir(process.env.CLAUDE_PROJECT_DIR);

await import(new URL("./index.js", import.meta.url));
