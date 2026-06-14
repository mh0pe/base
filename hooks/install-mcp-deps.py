#!/usr/bin/env python3
"""
SessionStart hook: install base-mcp npm dependencies into CLAUDE_PLUGIN_DATA.

Idempotent: exits 0 immediately if @modelcontextprotocol/sdk is already present.
Fail-open: warns to stderr and exits 0 on any error so the session always starts.

Strategy:
  1. npm install --omit=dev --prefix "$CLAUDE_PLUGIN_DATA"
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
    # MCP server lives at ${CLAUDE_PLUGIN_ROOT}/mcp/index.js — symlink goes next to it
    mcp_dir = os.path.join(plugin_root, "mcp")
    mcp_nm = os.path.join(mcp_dir, "node_modules")

    # Idempotent: if sdk already installed, just (re)assert symlink and exit
    if os.path.isdir(sdk_marker):
        # Re-assert symlink so it survives if the plugin dir was refreshed
        _assert_symlink(mcp_nm, plugin_data)
        sys.exit(0)

    # Source package.json is at ${CLAUDE_PLUGIN_ROOT}/mcp/package.json
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
        # Remove stale symlink so we can set the correct target
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
        print(
            f"[install-mcp-deps] WARNING: could not assert symlink {link_path} -> {target}: {exc}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
