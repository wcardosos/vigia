#!/usr/bin/env bash
# PostToolUse (vigia) — deterministic boundary sensor.
#
# Resolves the module from the edited file's path (first segment under the root that has its
# own Justfile), runs `just check` scoped to that module, and returns the error to the agent
# via exit 2. Edits outside of any module trigger nothing.

set -uo pipefail

# Project root: Claude Code exports CLAUDE_PROJECT_DIR in hooks.
root="${CLAUDE_PROJECT_DIR:-$PWD}"

# The event's file_path arrives as JSON on stdin. node is guaranteed in the environment.
file_path="$(
  node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{process.stdout.write((JSON.parse(s).tool_input||{}).file_path||"")}catch(e){}})'
)"

# No file (e.g. a tool with no file_path) → nothing to do.
[ -n "$file_path" ] || exit 0

# Path relative to the root (if the path is already relative, it stays as is).
rel="${file_path#"$root"/}"

# First segment of the relative path.
segment="${rel%%/*}"

# It is only a "module" if there is a subfolder (rel contains "/") and the segment has its own
# Justfile. This auto-discovers future modules (api/, web/) without keeping a list here.
if [ "$segment" = "$rel" ] || [ ! -f "$root/$segment/Justfile" ]; then
  exit 0
fi
module="$segment"

# The check depends on `just` (only exists in the devcontainer). Outside it, do not block edits.
if ! command -v just >/dev/null 2>&1; then
  echo "hook module-check: 'just' unavailable (outside the devcontainer?); module '$module' not verified." >&2
  exit 0
fi

# Run the full check scoped to the module (lint + tsc + depcruise + grep).
if ! output="$(cd "$root/$module" && just check 2>&1)"; then
  {
    echo "❌ just check failed in module '$module' (edited file: $rel)."
    echo "The task is not done while the check is not green again. Output:"
    echo
    echo "$output"
  } >&2
  exit 2
fi
exit 0
