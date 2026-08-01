@AGENTS.md

## Claude Code specifics

- Use plan mode before any change under `packages/engine/`. Propose the approach, wait for approval.
- After editing `generator.ts`, `solver.ts`, `validator.ts` or `refill.ts`, run the
  `engine-reviewer` subagent before opening a PR.
- Path-scoped rules in `.claude/rules/` load automatically when you touch matching files.
  Read them; they are not optional.
- On `/compact`, preserve: the current task contract, the frozen contract signatures,
  and any invariant IDs referenced in this session.
