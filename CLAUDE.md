@AGENTS.md

## Claude Code specifics

- Use plan mode before any change under `packages/engine/`. Propose the approach, wait for approval.
- After editing `generator.ts`, `solver.ts`, `validator.ts` or `refill.ts`, run the
  `engine-reviewer` subagent before opening a PR.
- Path-scoped rules in `.claude/rules/` load automatically when you touch matching files.
  Read them; they are not optional.
- **Check your working root before trusting any of the above.** `.claude/agents/` and
  `.claude/rules/` load only when the session is rooted at this repository. Start a
  session one directory up — at the folder _containing_ `poko/` — and they silently do
  not load: the `engine-reviewer` subagent reports "agent type not found", and the
  path-scoped rules never appear, so you work without the engine and backend rules and
  nothing tells you. Both have already happened. If `engine-reviewer` fails to resolve,
  that is the symptom: verify the root, and if you continue anyway, apply the missing
  checklists by hand and say plainly in the PR that you did.
- On `/compact`, preserve: the current task contract, the frozen contract signatures,
  and any invariant IDs referenced in this session.
