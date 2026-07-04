# vigia

Monorepo for **vigia** (self-hosted NVR). Each module has its own `CLAUDE.md` with the
module-specific rules — this file applies to the entire repository.

## Done = (non-negotiable)

A task is only **done** when, **in the module that was touched**:

- `just check` is green,
- `just test` is green,
- **acceptance tests exist and pass** — compiling and linting is not enough; without a test
  that exercises the behavior, the task is not done.

## How to run

- Verbs are invoked **via `just`** — the Justfile is the **single contract**. Never call
  `pnpm`, `eslint`, `tsc`, `vitest`, or `prettier` directly.
- Module verbs: `just check`, `just test`, `just format`, `just dev` (run from inside the
  module's folder). At the root, `just check-all` and `just test-all` dispatch to every
  module.
- Everything runs **inside the devcontainer** (`pnpm` via corepack, `just` and `ffmpeg` on
  PATH).

## Modules

- `recorder/` — recorder, Node/TS. See [`recorder/CLAUDE.md`](recorder/CLAUDE.md).
- `api/` — Java/Spring Boot (future session).
- `web/` — web app (future session).

**Flat** root: no `apps/`, no shared `packages/`. The modules are siblings at
the root; the question only reopens once there is shared code.
