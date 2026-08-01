#!/usr/bin/env bash
# Hard stop on commands no agent should run in this repo.
# Hooks execute regardless of what the model decides, which is why
# these live here and not in AGENTS.md.
set -uo pipefail

CMD=$(jq -r '.tool_input.command // empty' 2>/dev/null <<< "${1:-$(cat)}")
[ -z "$CMD" ] && exit 0

deny() { echo "BLOCKED: $1" >&2; exit 2; }

case "$CMD" in
  *"rm -rf /"*|*"rm -rf ~"*)          deny "destructive filesystem command" ;;
  *"git push --force"*|*"push -f"*)   deny "force push" ;;
  *"git reset --hard origin"*)        deny "hard reset onto a remote branch" ;;
  *"SUPABASE_SERVICE_ROLE"*)          deny "service-role key usage" ;;
  *"supabase link"*"--project-ref"*)  deny "linking a remote Supabase project; use the local one" ;;
  *"npm install"*|*"yarn add"*)       deny "wrong package manager — this repo uses pnpm" ;;
  *"pnpm add"*)                       deny "new dependency without an ADR (see AGENTS.md)" ;;
esac
exit 0
