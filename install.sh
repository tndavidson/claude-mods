#!/usr/bin/env bash
# Installs every mod in this repository into Claude Code at user scope.
#
# The repository root is a plugin marketplace (.claude-plugin/marketplace.json).
# This script registers it with Claude Code if it is not already, refreshes it
# otherwise, then installs each plugin the marketplace lists and updates any
# that were already installed, so the installed copies match this checkout.
# Re-run it after every change you want other sessions to see.
#
# Usage: ./install.sh [--scope user|project|local]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$ROOT/.claude-plugin/marketplace.json"
SCOPE="user"

while [ $# -gt 0 ]; do
  case "$1" in
    --scope) SCOPE="$2"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "install.sh: unknown argument: $1" >&2; exit 2 ;;
  esac
done

command -v claude >/dev/null || { echo "install.sh: the claude CLI is not on PATH" >&2; exit 1; }
command -v python3 >/dev/null || { echo "install.sh: python3 is needed to read $MANIFEST" >&2; exit 1; }

MARKET="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["name"])' "$MANIFEST")"
PLUGINS="$(python3 -c 'import json,sys; print("\n".join(p["name"] for p in json.load(open(sys.argv[1]))["plugins"]))' "$MANIFEST")"

if claude plugin marketplace list 2>/dev/null | grep -q "^  ❯ $MARKET\$"; then
  echo "Refreshing marketplace $MARKET"
  claude plugin marketplace update "$MARKET"
else
  echo "Adding marketplace $MARKET from $ROOT"
  claude plugin marketplace add "$ROOT"
fi

# Installing copies a plugin into Claude Code's cache once; a plugin that is
# already installed keeps its cached copy until it is updated, and an update
# only copies when the plugin's version in plugin.json has moved.
for plugin in $PLUGINS; do
  if claude plugin list 2>/dev/null | grep -q "^  ❯ $plugin@$MARKET\$"; then
    echo "Updating $plugin@$MARKET at $SCOPE scope"
    claude plugin update "$plugin@$MARKET" --scope "$SCOPE"
  else
    echo "Installing $plugin@$MARKET at $SCOPE scope"
    claude plugin install "$plugin@$MARKET" --scope "$SCOPE"
  fi
done

echo
echo "Open sessions pick the new copies up with /reload-plugins; new sessions load them as they start."

echo
claude plugin list
