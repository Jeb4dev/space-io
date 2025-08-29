# Contributing

- TypeScript strict everywhere. No `any` unless unavoidable.
- Small modules; clear names; early returns.
- One class/function per file; re-export from package boundaries only.
- Conventional Commits. Keep PRs small (<400 lines net if possible).
- Run `pnpm typecheck && pnpm lint` before pushing.
