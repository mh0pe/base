#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync } = require('child_process');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Get version from package.json
const pkg = require('../package.json');

const banner = `
${cyan}  ██████╗  █████╗ ███████╗███████╗
  ██╔══██╗██╔══██╗██╔════╝██╔════╝
  ██████╔╝███████║███████╗█████╗
  ██╔══██╗██╔══██║╚════██║██╔══╝
  ██████╔╝██║  ██║███████║███████╗
  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝${reset}

  BASE Framework ${dim}v${pkg.version}${reset}
  Builder's Automated State Engine for Claude Code
`;

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasWorkspace = args.includes('--workspace') || args.includes('-w');

// Parse --config-dir argument
function parseConfigDirArg() {
  const configDirIndex = args.findIndex(arg => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
      process.exit(1);
    }
    return nextArg;
  }
  const configDirArg = args.find(arg => arg.startsWith('--config-dir=') || arg.startsWith('-c='));
  if (configDirArg) {
    return configDirArg.split('=')[1];
  }
  return null;
}
const explicitConfigDir = parseConfigDirArg();

// Parse --workspace-dir argument
function parseWorkspaceDirArg() {
  const idx = args.findIndex(arg => arg === '--workspace-dir');
  if (idx !== -1) {
    const nextArg = args[idx + 1];
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--workspace-dir requires a path argument${reset}`);
      process.exit(1);
    }
    return nextArg;
  }
  return null;
}
const explicitWorkspaceDir = parseWorkspaceDirArg();
const hasHelp = args.includes('--help') || args.includes('-h');

// Parse --skills-dir flag and optional --dir <path>
const hasSkillsDir = args.includes('--skills-dir');

function parseSkillsDirTarget() {
  const idx = args.findIndex(arg => arg === '--dir');
  if (idx !== -1) {
    const nextArg = args[idx + 1];
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--dir requires a path argument${reset}`);
      process.exit(1);
    }
    return nextArg;
  }
  return null;
}
const explicitSkillsDirTarget = parseSkillsDirTarget();

console.log(banner);

// Show help if requested
if (hasHelp) {
  console.log(`  ${yellow}Usage:${reset} npx base-framework [options]

  ${yellow}Options:${reset}
    ${cyan}-g, --global${reset}                 Install commands globally (to ~/.claude)
    ${cyan}-l, --local${reset}                  Install commands locally (to ./.claude)
    ${cyan}-w, --workspace${reset}              Install workspace layer (.base/ in current directory)
    ${cyan}-c, --config-dir <path>${reset}      Specify custom Claude config directory
    ${cyan}--workspace-dir <path>${reset}        Specify workspace root (default: cwd)
    ${cyan}--skills-dir [--dir <path>]${reset}  Install as a self-contained Claude Code skills-dir plugin
    ${cyan}-h, --help${reset}                   Show this help message

  ${yellow}Examples:${reset}
    ${dim}# Full install: global commands + workspace layer${reset}
    npx base-framework --global --workspace

    ${dim}# Global commands only (no workspace data)${reset}
    npx base-framework --global

    ${dim}# Workspace layer only (assumes commands already installed)${reset}
    npx base-framework --workspace

    ${dim}# Install to current project only${reset}
    npx base-framework --local --workspace

  ${yellow}What gets installed:${reset}
    ${cyan}Commands (--global or --local):${reset}
      commands/base/       - Slash commands (/base:surface-create, /base:orientation, etc.)
      skills/base/         - Skill framework (tasks, templates, context)

    ${cyan}Workspace (--workspace):${reset}
      .base/data/          - JSON data surfaces (active, backlog, projects, entities, state)
      .base/hooks/         - All hooks (surface + session + command)
      .base/base-mcp/      - BASE MCP server (npm install auto-runs)
      .base/schemas/       - JSON validation schemas
      .base/grooming/      - Weekly groom reports
      .base/audits/        - Audit history
      .base/workspace.json - Workspace manifest
      .base/operator.json  - Operator profile (guided setup via /base:orientation)
      .mcp.json            - MCP server registration (merged)
`);
  process.exit(0);
}

/**
 * Expand ~ to home directory
 */
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Recursively copy directory
 */
function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Write JSON file only if it doesn't already exist
 */
function writeJsonIfNew(filePath, data) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  }
  return false;
}

/**
 * Detect v1/v2 artifacts that need migration.
 * Returns array of { path, label, type } objects.
 * Does NOT modify anything — detection only.
 */
function detectV1Artifacts(claudeDir, workspaceDir) {
  const found = [];

  if (workspaceDir) {
    // carl-mcp in .base/ (no longer ships with BASE)
    const carlMcpDir = path.join(workspaceDir, '.base', 'carl-mcp');
    if (fs.existsSync(carlMcpDir)) {
      found.push({
        path: carlMcpDir,
        label: '.base/carl-mcp/',
        reason: 'CARL MCP no longer ships with BASE — install carl-core separately',
        type: 'directory'
      });
    }

    // Session hooks in .claude/hooks/ that moved to .base/hooks/
    const movedHooks = ['base-pulse-check.py', 'psmm-injector.py', 'satellite-detection.py'];
    const claudeHooksDir = path.join(workspaceDir, '.claude', 'hooks');
    if (fs.existsSync(claudeHooksDir)) {
      for (const hook of movedHooks) {
        const hookPath = path.join(claudeHooksDir, hook);
        if (fs.existsSync(hookPath)) {
          found.push({
            path: hookPath,
            label: `.claude/hooks/${hook}`,
            reason: 'Hooks now live in .base/hooks/ — duplicate here causes double-fire',
            type: 'file'
          });
        }
      }
    }

    // v2-suffixed hook files in .base/hooks/ (now redundant — canonical names have v2 content)
    const v2SuffixedHooks = ['active-hook-v2.py', 'backlog-hook-v2.py', 'base-pulse-check-v2.py'];
    const baseHooksDir = path.join(workspaceDir, '.base', 'hooks');
    if (fs.existsSync(baseHooksDir)) {
      for (const hook of v2SuffixedHooks) {
        const hookPath = path.join(baseHooksDir, hook);
        if (fs.existsSync(hookPath)) {
          found.push({
            path: hookPath,
            label: `.base/hooks/${hook}`,
            reason: 'v2-suffixed duplicate — canonical name now has v2 content',
            type: 'file'
          });
        }
      }
    }

    // Stale -v2 hook paths in .claude/settings.json
    const settingsPath = path.join(workspaceDir, '.claude', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      try {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        if (raw.includes('-v2.py')) {
          found.push({
            path: settingsPath,
            label: '.claude/settings.json → stale -v2 hook paths',
            reason: 'Hook paths reference -v2.py files that are now archived — will rewrite to canonical names',
            type: 'settings-v2-paths'
          });
        }
      } catch (e) { /* skip */ }
    }

    // carl-mcp entry in .mcp.json
    const mcpJsonPath = path.join(workspaceDir, '.mcp.json');
    if (fs.existsSync(mcpJsonPath)) {
      try {
        const mcpConfig = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
        if (mcpConfig.mcpServers && mcpConfig.mcpServers['carl-mcp']) {
          found.push({
            path: mcpJsonPath,
            label: '.mcp.json → carl-mcp entry',
            reason: 'CARL MCP no longer registered by BASE — install carl-core for CARL MCP',
            type: 'mcp-entry'
          });
        }
      } catch (e) { /* skip */ }
    }
  }

  // Old markdown templates in base-framework/
  if (claudeDir) {
    const oldTemplates = ['active-md.md', 'backlog-md.md', 'state-md.md'];
    const templatesDir = path.join(claudeDir, 'base-framework', 'templates');
    if (fs.existsSync(templatesDir)) {
      for (const tmpl of oldTemplates) {
        const tmplPath = path.join(templatesDir, tmpl);
        if (fs.existsSync(tmplPath)) {
          found.push({
            path: tmplPath,
            label: `base-framework/templates/${tmpl}`,
            reason: 'Replaced by JSON templates in v3 — no longer used by scaffold',
            type: 'file'
          });
        }
      }
    }
  }

  return found;
}

/**
 * Archive a single artifact (file or directory) to .base/_archive/upgrade-v3/
 */
function archiveArtifact(artifact, archiveDir) {
  fs.mkdirSync(archiveDir, { recursive: true });

  if (artifact.type === 'directory') {
    const destName = path.basename(artifact.path);
    const destPath = path.join(archiveDir, destName);
    copyDir(artifact.path, destPath);
    fs.rmSync(artifact.path, { recursive: true });
  } else if (artifact.type === 'file') {
    const destPath = path.join(archiveDir, path.basename(artifact.path));
    fs.copyFileSync(artifact.path, destPath);
    fs.unlinkSync(artifact.path);
  } else if (artifact.type === 'mcp-entry') {
    // For MCP entries, remove the key from JSON
    const mcpConfig = JSON.parse(fs.readFileSync(artifact.path, 'utf-8'));
    delete mcpConfig.mcpServers['carl-mcp'];
    fs.writeFileSync(artifact.path, JSON.stringify(mcpConfig, null, 2));
  } else if (artifact.type === 'settings-v2-paths') {
    // Rewrite -v2.py hook paths to canonical names in settings.json
    let raw = fs.readFileSync(artifact.path, 'utf-8');
    raw = raw.replace(/active-hook-v2\.py/g, 'active-hook.py');
    raw = raw.replace(/backlog-hook-v2\.py/g, 'backlog-hook.py');
    raw = raw.replace(/base-pulse-check-v2\.py/g, 'base-pulse-check.py');
    fs.writeFileSync(artifact.path, raw);
  }
}

/**
 * Run upgrade cleanup interactively.
 * Detects v1/v2 artifacts, warns the user, prompts for confirmation, archives.
 * Returns a promise that resolves when cleanup is complete or skipped.
 */
function runUpgradeCleanup(claudeDir, workspaceDir) {
  const artifacts = detectV1Artifacts(claudeDir, workspaceDir);
  if (artifacts.length === 0) return Promise.resolve();

  const baseDir = workspaceDir ? path.join(workspaceDir, '.base') : path.join(process.cwd(), '.base');
  const archiveDir = path.join(baseDir, '_archive', 'upgrade-v3');

  console.log(`  ${yellow}=== UPGRADE DETECTED ===${reset}`);
  console.log(`  Found ${artifacts.length} artifact(s) from a previous BASE version:\n`);
  for (const a of artifacts) {
    console.log(`  ${yellow}!${reset} ${a.label}`);
    console.log(`    ${dim}${a.reason}${reset}`);
  }
  console.log(`\n  ${dim}These will be archived to: ${archiveDir.replace(os.homedir(), '~')}${reset}`);
  console.log(`  ${dim}Nothing is deleted — you can recover from the archive.${reset}\n`);

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`  Archive these artifacts? ${dim}[Y/n]${reset}: `, (answer) => {
      rl.close();
      const proceed = !answer.trim() || answer.trim().toLowerCase() === 'y';
      if (proceed) {
        for (const a of artifacts) {
          archiveArtifact(a, archiveDir);
          console.log(`  ${green}archived${reset} ${a.label}`);
        }
        console.log('');
      } else {
        console.log(`  ${dim}Skipped cleanup. Old artifacts left in place.${reset}\n`);
      }
      resolve();
    });
  });
}

/**
 * Install commands and skill framework
 */
function installCommands(isGlobal) {
  const src = path.join(__dirname, '..');
  const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
  const defaultGlobalDir = configDir || path.join(os.homedir(), '.claude');
  const claudeDir = isGlobal ? defaultGlobalDir : path.join(process.cwd(), '.claude');

  const locationLabel = isGlobal
    ? claudeDir.replace(os.homedir(), '~')
    : claudeDir.replace(process.cwd(), '.');

  console.log(`  Installing commands to ${cyan}${locationLabel}${reset}\n`);

  // Copy commands
  const commandsSrc = path.join(src, 'src', 'commands');
  const commandsDest = path.join(claudeDir, 'commands', 'base');
  copyDir(commandsSrc, commandsDest);
  const commandCount = fs.readdirSync(commandsSrc).filter(f => f.endsWith('.md')).length;
  console.log(`  ${green}+${reset} commands/base/ (${commandCount} slash commands)`);

  // Copy skill entry point
  const skillSrc = path.join(src, 'src', 'skill');
  const skillDest = path.join(claudeDir, 'skills', 'base');
  copyDir(skillSrc, skillDest);
  console.log(`  ${green}+${reset} skills/base/ (entry point + MCP package sources)`);

  // Copy MCP package sources into skill (for scaffold reference)
  const packagesSrc = path.join(src, 'src', 'packages');
  const packagesDest = path.join(claudeDir, 'skills', 'base', 'packages');
  copyDir(packagesSrc, packagesDest);

  // Copy MCP package to base-framework/packages/ (global source for scaffold)
  const frameworkPackagesDest = path.join(claudeDir, 'base-framework', 'packages', 'base-mcp');
  fs.mkdirSync(frameworkPackagesDest, { recursive: true });
  copyDir(path.join(src, 'src', 'packages', 'base-mcp'), frameworkPackagesDest);
  console.log(`  ${green}+${reset} base-framework/packages/base-mcp/ (global MCP source for scaffold)`);

  // Copy BASE framework (tasks, templates, context, frameworks)
  const frameworkSrc = path.join(src, 'src', 'framework');
  const frameworkDest = path.join(claudeDir, 'base-framework');
  copyDir(frameworkSrc, frameworkDest);
  console.log(`  ${green}+${reset} base-framework/ (tasks, templates, context, frameworks, utils)`);

  // Copy all hooks to base-framework/hooks/ (source for scaffold)
  const hooksFrameworkDest = path.join(claudeDir, 'base-framework', 'hooks');
  fs.mkdirSync(hooksFrameworkDest, { recursive: true });
  const hooksSrcDir = path.join(src, 'src', 'hooks');
  const hookFiles = fs.readdirSync(hooksSrcDir).filter(f => f.endsWith('.py'));
  for (const hookFile of hookFiles) {
    fs.copyFileSync(path.join(hooksSrcDir, hookFile), path.join(hooksFrameworkDest, hookFile));
  }
  console.log(`  ${green}+${reset} base-framework/hooks/ (${hookFiles.length} hooks for scaffold)`);

  console.log(`\n  ${green}Commands installed.${reset}\n`);
}

/**
 * Install workspace layer (.base/)
 */
function installWorkspace() {
  const src = path.join(__dirname, '..');
  const workspaceDir = expandTilde(explicitWorkspaceDir) || process.cwd();
  const baseDir = path.join(workspaceDir, '.base');

  console.log(`  Installing workspace layer to ${cyan}${baseDir.replace(os.homedir(), '~')}${reset}\n`);

  // Create .base directories
  fs.mkdirSync(path.join(baseDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'grooming'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'audits'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'schemas'), { recursive: true });
  console.log(`  ${green}+${reset} .base/data/`);
  console.log(`  ${green}+${reset} .base/hooks/`);
  console.log(`  ${green}+${reset} .base/grooming/`);
  console.log(`  ${green}+${reset} .base/audits/`);
  console.log(`  ${green}+${reset} .base/schemas/`);

  // Initialize JSON data surfaces (don't overwrite existing)
  const dataSurfaces = {
    'projects.json': { version: 1, workspace: '', last_modified: null, categories: [], items: [], archived: [] },
    'entities.json': { entities: [], last_updated: null },
    'state.json': { drift_score: 0, areas: {}, last_groom: null, last_updated: null },
    'psmm.json': { sessions: {} },
    'staging.json': { proposals: [] }
  };
  let surfaceCount = 0;
  for (const [filename, data] of Object.entries(dataSurfaces)) {
    if (writeJsonIfNew(path.join(baseDir, 'data', filename), data)) {
      surfaceCount++;
    }
  }
  if (surfaceCount > 0) {
    console.log(`  ${green}+${reset} .base/data/ (${surfaceCount} JSON surfaces initialized)`);
  } else {
    console.log(`  ${dim}  .base/data/ (existing surfaces preserved)${reset}`);
  }

  // Copy workspace.json template (don't overwrite existing)
  const workspaceJsonDest = path.join(baseDir, 'workspace.json');
  if (!fs.existsSync(workspaceJsonDest)) {
    const templateSrc = path.join(src, 'src', 'templates', 'workspace.json');
    if (fs.existsSync(templateSrc)) {
      const template = JSON.parse(fs.readFileSync(templateSrc, 'utf-8'));
      template.workspace = path.basename(workspaceDir);
      template.created = new Date().toISOString().split('T')[0];
      fs.writeFileSync(workspaceJsonDest, JSON.stringify(template, null, 2));
      console.log(`  ${green}+${reset} .base/workspace.json (manifest)`);
    }
  } else {
    console.log(`  ${dim}  .base/workspace.json (existing manifest preserved)${reset}`);
  }

  // Copy operator.json template (don't overwrite existing)
  const operatorJsonDest = path.join(baseDir, 'operator.json');
  if (!fs.existsSync(operatorJsonDest)) {
    const operatorSrc = path.join(src, 'src', 'templates', 'operator.json');
    if (fs.existsSync(operatorSrc)) {
      fs.copyFileSync(operatorSrc, operatorJsonDest);
      console.log(`  ${green}+${reset} .base/operator.json (operator profile — complete via /base:scaffold)`);
    }
  } else {
    console.log(`  ${dim}  .base/operator.json (existing profile preserved)${reset}`);
  }

  // Copy JSON schemas for data surface validation
  const schemasSrc = path.join(src, 'schemas');
  const schemasDest = path.join(baseDir, 'schemas');
  if (fs.existsSync(schemasSrc)) {
    const schemaFiles = fs.readdirSync(schemasSrc).filter(f => f.endsWith('.json'));
    for (const file of schemaFiles) {
      fs.copyFileSync(path.join(schemasSrc, file), path.join(schemasDest, file));
    }
    console.log(`  ${green}+${reset} .base/schemas/ (${schemaFiles.length} validation schemas)`);
  }

  // Copy base-mcp
  const baseMcpSrc = path.join(src, 'src', 'packages', 'base-mcp');
  const baseMcpDest = path.join(baseDir, 'base-mcp');
  copyDir(baseMcpSrc, baseMcpDest);
  console.log(`  ${green}+${reset} .base/base-mcp/`);

  // Copy all hooks to .base/hooks/
  const allHooksSrc = path.join(src, 'src', 'hooks');
  const hookEntries = fs.readdirSync(allHooksSrc).filter(f => f.endsWith('.py'));
  for (const file of hookEntries) {
    fs.copyFileSync(path.join(allHooksSrc, file), path.join(baseDir, 'hooks', file));
  }
  console.log(`  ${green}+${reset} .base/hooks/ (${hookEntries.length} hooks)`);

  // npm install for base-mcp
  console.log(`\n  Installing MCP dependencies...`);
  try {
    execSync('npm install', { cwd: baseMcpDest, stdio: 'pipe' });
    console.log(`  ${green}+${reset} base-mcp dependencies installed`);
  } catch (e) {
    console.log(`  ${yellow}!${reset} base-mcp npm install failed — run manually in .base/base-mcp/`);
  }

  // Merge MCP registration into .mcp.json
  const mcpJsonPath = path.join(workspaceDir, '.mcp.json');
  let mcpConfig = { mcpServers: {} };
  if (fs.existsSync(mcpJsonPath)) {
    try {
      mcpConfig = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
    } catch (e) { /* start fresh */ }
  }
  mcpConfig.mcpServers['base-mcp'] = {
    type: 'stdio',
    command: 'node',
    args: ['./.base/base-mcp/index.js']
  };
  fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2));
  console.log(`  ${green}+${reset} .mcp.json (base-mcp registered)`);

  console.log(`\n  ${green}Workspace layer installed.${reset}`);
  console.log(`  Run ${cyan}/base:scaffold${reset} to complete setup (hook wiring, operator profile).\n`);
}

/**
 * Rewrite @~/.claude/base-framework/ and @./.claude/base-framework/ refs
 * to ${CLAUDE_PLUGIN_ROOT}/base-framework/ in the given text.
 */
function rewriteBaseFrameworkRefs(text) {
  text = text.replace(/@~\/\.claude\/base-framework\//g, '@${CLAUDE_PLUGIN_ROOT}/base-framework/');
  text = text.replace(/@\.\/\.claude\/base-framework\//g, '@${CLAUDE_PLUGIN_ROOT}/base-framework/');
  return text;
}

/**
 * Install as a self-contained Claude Code skills-dir plugin.
 * Target: --dir <path> or default <cwd>/.claude/skills/base/
 */
function installSkillsDir() {
  const src = path.join(__dirname, '..');
  const targetBase = explicitSkillsDirTarget
    ? path.resolve(expandTilde(explicitSkillsDirTarget))
    : path.join(process.cwd(), '.claude', 'skills', 'base');

  const pluginDir = path.join(targetBase, '.claude-plugin');
  const commandsDir = path.join(targetBase, 'commands');
  const skillsDir = path.join(targetBase, 'skills');
  const frameworkDir = path.join(targetBase, 'base-framework');
  const hooksDir = path.join(targetBase, 'hooks');
  const mcpDir = path.join(targetBase, 'mcp');

  const targetLabel = targetBase.replace(os.homedir(), '~').replace(process.cwd(), '.');
  console.log(`  Installing skills-dir plugin to ${cyan}${targetLabel}${reset}\n`);

  // Create plugin manifest
  fs.mkdirSync(pluginDir, { recursive: true });
  const pluginJson = {
    name: 'base',
    version: pkg.version,
    description: "Builder's Automated State Engine — workspace lifecycle management for Claude Code. Scaffold, audit, groom, and maintain AI builder workspaces."
  };
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(pluginJson, null, 2));
  console.log(`  ${green}+${reset} .claude-plugin/plugin.json`);

  // Copy commands — rewrite base-framework refs in each .md file
  const commandsSrc = path.join(src, 'src', 'commands');
  fs.mkdirSync(commandsDir, { recursive: true });
  const copyDirRewritingRefs = (srcDir, destDir) => {
    fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        copyDirRewritingRefs(srcPath, destPath);
      } else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(srcPath, 'utf-8');
        fs.writeFileSync(destPath, rewriteBaseFrameworkRefs(content));
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };
  copyDirRewritingRefs(commandsSrc, commandsDir);
  const commandCount = fs.readdirSync(commandsSrc).filter(f => f.endsWith('.md')).length;
  console.log(`  ${green}+${reset} commands/ (${commandCount} slash commands, refs rewritten)`);

  // Copy skill entry point — rewrite refs
  const skillSrc = path.join(src, 'src', 'skill');
  fs.mkdirSync(skillsDir, { recursive: true });
  copyDirRewritingRefs(skillSrc, skillsDir);
  console.log(`  ${green}+${reset} skills/ (entry point)`);

  // Copy BASE framework — tasks, templates, context, frameworks
  const frameworkSrc = path.join(src, 'src', 'framework');
  copyDirRewritingRefs(frameworkSrc, frameworkDir);
  // Copy hooks into base-framework/hooks/ (for scaffold reference)
  const hooksFrameworkDest = path.join(frameworkDir, 'hooks');
  fs.mkdirSync(hooksFrameworkDest, { recursive: true });
  const hooksSrcDir = path.join(src, 'src', 'hooks');
  const hookFiles = fs.readdirSync(hooksSrcDir).filter(f => f.endsWith('.py'));
  for (const hookFile of hookFiles) {
    fs.copyFileSync(path.join(hooksSrcDir, hookFile), path.join(hooksFrameworkDest, hookFile));
  }
  // Copy MCP package into base-framework/packages/base-mcp/
  const fwPkgDest = path.join(frameworkDir, 'packages', 'base-mcp');
  fs.mkdirSync(fwPkgDest, { recursive: true });
  copyDir(path.join(src, 'src', 'packages', 'base-mcp'), fwPkgDest);
  console.log(`  ${green}+${reset} base-framework/ (tasks, templates, context, frameworks, hooks, packages)`);

  // Copy hooks/ as standalone directory
  fs.mkdirSync(hooksDir, { recursive: true });
  for (const hookFile of hookFiles) {
    fs.copyFileSync(path.join(hooksSrcDir, hookFile), path.join(hooksDir, hookFile));
  }
  console.log(`  ${green}+${reset} hooks/ (${hookFiles.length} hook scripts)`);

  // Emit SessionStart deps-installer script
  const installMcpDepsScript = `#!/usr/bin/env python3
"""
SessionStart hook: install base-mcp npm dependencies into CLAUDE_PLUGIN_DATA.

Idempotent: exits 0 immediately if @modelcontextprotocol/sdk is already present.
Fail-open: warns to stderr and exits 0 on any error so the session always starts.

Strategy:
  1. npm install --omit=dev --prefix "$CLAUDE_PLUGIN_DATA"
     -> places node_modules at $CLAUDE_PLUGIN_DATA/node_modules/
  2. symlink $CLAUDE_PLUGIN_ROOT/mcp/base-mcp/node_modules
             -> $CLAUDE_PLUGIN_DATA/node_modules
     Node ESM resolves bare specifiers by walking up from the importing file, so
     node_modules must live adjacent to index.js. NODE_PATH is honored only by
     the CommonJS loader (node:internal/modules/cjs), not the ESM loader; this
     symlink bridges the two locations so ESM resolution succeeds.
"""
import os
import sys
import shutil
import subprocess

def warn(msg):
    print(f"[install-mcp-deps] WARNING: {msg}", file=sys.stderr)

def main():
    plugin_root = os.environ.get("CLAUDE_PLUGIN_ROOT", "").strip()
    plugin_data = os.environ.get("CLAUDE_PLUGIN_DATA", "").strip()

    if not plugin_data:
        warn("CLAUDE_PLUGIN_DATA is not set; skipping MCP deps install.")
        sys.exit(0)

    if not plugin_root:
        warn("CLAUDE_PLUGIN_ROOT is not set; skipping MCP deps install.")
        sys.exit(0)

    sdk_marker = os.path.join(plugin_data, "node_modules", "@modelcontextprotocol", "sdk")
    mcp_dir = os.path.join(plugin_root, "mcp", "base-mcp")
    mcp_nm = os.path.join(mcp_dir, "node_modules")

    # Idempotent: if sdk already installed, just (re)assert symlink and exit
    if os.path.isdir(sdk_marker):
        # Re-assert symlink so it survives if the MCP dir was re-emitted
        _assert_symlink(mcp_nm, plugin_data)
        sys.exit(0)

    # Copy package.json (and lockfile if present) into CLAUDE_PLUGIN_DATA
    src_pkg = os.path.join(mcp_dir, "package.json")
    if not os.path.isfile(src_pkg):
        warn(f"package.json not found at {src_pkg}; skipping.")
        sys.exit(0)

    try:
        os.makedirs(plugin_data, exist_ok=True)
        shutil.copy2(src_pkg, os.path.join(plugin_data, "package.json"))

        lockfile = os.path.join(mcp_dir, "package-lock.json")
        if os.path.isfile(lockfile):
            shutil.copy2(lockfile, os.path.join(plugin_data, "package-lock.json"))

        npm = shutil.which("npm")
        if not npm:
            warn("npm not found in PATH; skipping MCP deps install.")
            sys.exit(0)

        result = subprocess.run(
            [npm, "install", "--omit=dev", "--prefix", plugin_data],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            warn(f"npm install failed (exit {result.returncode}): {result.stderr.strip()}")
            sys.exit(0)

        _assert_symlink(mcp_nm, plugin_data)
        print(f"[install-mcp-deps] MCP deps installed to {plugin_data}", file=sys.stderr)

    except Exception as exc:
        warn(f"Unexpected error during MCP deps install: {exc}")
        sys.exit(0)


def _assert_symlink(link_path, plugin_data):
    """Create or update the node_modules symlink inside the MCP dir."""
    target = os.path.join(plugin_data, "node_modules")
    try:
        # Remove stale symlink or real dir so we can set the correct target
        if os.path.islink(link_path):
            if os.readlink(link_path) == target:
                return  # already correct
            os.unlink(link_path)
        elif os.path.isdir(link_path):
            # A real node_modules exists (e.g. from a previous local install);
            # leave it alone so we don't break a working setup.
            return
        os.symlink(target, link_path)
    except Exception as exc:
        print(f"[install-mcp-deps] WARNING: could not assert symlink {link_path} -> {target}: {exc}", file=sys.stderr)


if __name__ == "__main__":
    main()
`;

  fs.writeFileSync(path.join(hooksDir, 'install-mcp-deps.py'), installMcpDepsScript);
  console.log(`  ${green}+${reset} hooks/install-mcp-deps.py (SessionStart MCP deps installer)`);

  // Write hooks.json — wires base's hooks using ${CLAUDE_PLUGIN_ROOT} paths
  const hooksJson = {
    hooks: {
      UserPromptSubmit: [
        {
          hooks: [
            { type: 'command', command: 'python3 ${CLAUDE_PLUGIN_ROOT}/hooks/active-hook.py' },
            { type: 'command', command: 'python3 ${CLAUDE_PLUGIN_ROOT}/hooks/backlog-hook.py' },
            { type: 'command', command: 'python3 ${CLAUDE_PLUGIN_ROOT}/hooks/base-pulse-check.py' },
            { type: 'command', command: 'python3 ${CLAUDE_PLUGIN_ROOT}/hooks/psmm-injector.py' },
            { type: 'command', command: 'python3 ${CLAUDE_PLUGIN_ROOT}/hooks/operator.py' }
          ]
        }
      ],
      SessionStart: [
        {
          hooks: [
            { type: 'command', command: 'python3 ${CLAUDE_PLUGIN_ROOT}/hooks/satellite-detection.py' },
            { type: 'command', command: 'python3 ${CLAUDE_PLUGIN_ROOT}/hooks/install-mcp-deps.py' }
          ]
        }
      ]
    }
  };
  fs.writeFileSync(path.join(hooksDir, 'hooks.json'), JSON.stringify(hooksJson, null, 2));
  console.log(`  ${green}+${reset} hooks/hooks.json (UserPromptSubmit x5 + SessionStart x2: satellite-detection + install-mcp-deps)`);

  // Copy MCP package into mcp/base-mcp/
  const mcpPkgDest = path.join(mcpDir, 'base-mcp');
  fs.mkdirSync(mcpPkgDest, { recursive: true });
  copyDir(path.join(src, 'src', 'packages', 'base-mcp'), mcpPkgDest);
  console.log(`  ${green}+${reset} mcp/base-mcp/ (MCP server source)`);

  // Write .mcp.json at plugin root with NODE_PATH + CLAUDE_PROJECT_DIR env
  const mcpJson = {
    mcpServers: {
      'base-mcp': {
        type: 'stdio',
        command: 'node',
        args: ['${CLAUDE_PLUGIN_ROOT}/mcp/base-mcp/index.js'],
        env: {
          CLAUDE_PROJECT_DIR: '${CLAUDE_PROJECT_DIR}',
          NODE_PATH: '${CLAUDE_PLUGIN_DATA}/node_modules'
        }
      }
    }
  };
  fs.writeFileSync(path.join(targetBase, '.mcp.json'), JSON.stringify(mcpJson, null, 2));
  console.log(`  ${green}+${reset} .mcp.json (base-mcp at plugin root; NODE_PATH + CLAUDE_PROJECT_DIR in env)`);

  console.log(`\n  ${green}Skills-dir plugin installed.${reset}`);
  console.log(`  ${dim}Loads next session as base@skills-dir (no marketplace/install).${reset}`);
  console.log(`  ${dim}Trust the workspace if prompted.${reset}`);
  console.log(`  ${dim}For Claude Code Cloud, commit .claude/skills/base/.${reset}\n`);
}

/**
 * Prompt for install location
 */
function promptLocation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
  const globalPath = configDir || path.join(os.homedir(), '.claude');
  const globalLabel = globalPath.replace(os.homedir(), '~');

  console.log(`  ${yellow}What would you like to install?${reset}

  ${cyan}1${reset}) Full install  ${dim}(commands to ${globalLabel} + workspace layer to .base/)${reset}
  ${cyan}2${reset}) Commands only  ${dim}(${globalLabel})${reset}
  ${cyan}3${reset}) Workspace only ${dim}(.base/ in current directory)${reset}
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    if (choice === '1' || choice === '2') {
      installCommands(true);
    }
    if (choice === '1' || choice === '3') {
      installWorkspace();
    }
    if (choice !== '1' && choice !== '2' && choice !== '3') {
      installCommands(true);
      installWorkspace();
    }
    console.log(`  ${green}Done!${reset} Launch Claude Code and run ${cyan}/base:scaffold${reset} to complete setup.\n`);
  });
}

// Main
async function main() {
  if (hasHelp) {
    return; // Already handled above
  }

  if (hasSkillsDir) {
    if (hasGlobal || hasLocal) {
      console.error(`  ${yellow}Cannot combine --skills-dir with --global or --local${reset}`);
      process.exit(1);
    }
    installSkillsDir();
    return;
  }

  if (hasGlobal || hasLocal || hasWorkspace) {
    if (hasGlobal && hasLocal) {
      console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
      process.exit(1);
    }

    // Detect and offer cleanup of v1/v2 artifacts before installing
    const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
    const cleanupClaudeDir = (hasGlobal || hasLocal)
      ? (hasGlobal ? (configDir || path.join(os.homedir(), '.claude')) : path.join(process.cwd(), '.claude'))
      : null;
    const cleanupWorkspaceDir = hasWorkspace
      ? (expandTilde(explicitWorkspaceDir) || process.cwd())
      : null;

    await runUpgradeCleanup(cleanupClaudeDir, cleanupWorkspaceDir);

    if (hasGlobal || hasLocal) {
      installCommands(hasGlobal);
    }
    if (hasWorkspace) {
      installWorkspace();
    }
    console.log(`  ${green}Done!${reset} Launch Claude Code and run ${cyan}/base:scaffold${reset} to complete setup.\n`);
  } else {
    promptLocation();
  }
}

main();
