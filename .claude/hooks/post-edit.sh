#!/usr/bin/env bash
# Lint and typecheck what was just edited. Catches drift in seconds
# instead of at PR time. Non-blocking on tooling failure, blocking on
# a real lint or type error.
set -uo pipefail

FILES="${CLAUDE_FILE_PATHS:-}"
[ -z "$FILES" ] && exit 0

TS_FILES=$(echo "$FILES" | tr ' ' '\n' | grep -E '\.(ts|tsx)$' || true)
[ -z "$TS_FILES" ] && exit 0

pnpm exec eslint --fix $TS_FILES || exit 2
pnpm exec tsc --noEmit -p tsconfig.base.json || exit 2
exit 0
