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
  module — assim como os agregadores por bucket `just test-unit-all`, `just test-integration-all`
  e `just test-e2e-all`, que o CI roda em steps separados nessa ordem.
- A toolchain é definida pelo **`Dockerfile` da raiz**, não por nenhuma máquina. Estágios:
  `base` (Node + pnpm + `just`, pinados) → `media` (+ ffmpeg, tzdata) → `dev` (+ mprocs, alvo
  do devcontainer). Localmente você trabalha no devcontainer (`dev`); **o CI roda a mesma
  imagem `base`**.
- Logo: se um verbo `just` precisa de uma ferramenta, ela vai no `Dockerfile` — nunca como
  step avulso no workflow.
- **`base` não tem ffmpeg, e o CI roda em `base`.** Nenhum teste pode depender do binário; o
  encoder é exercitado pelo seam de spawn injetado. Um teste que chame ffmpeg de verdade passa
  local e falha no CI — por desenho.
- Os pins vivem nos `ARG` do `Dockerfile` e em `recorder/package.json` → `packageManager`.
  Subir Node ou pnpm significa editar os dois.

## Modules

- `recorder/` — recorder, Node/TS. See [`recorder/CLAUDE.md`](recorder/CLAUDE.md).
- `api/` — Java/Spring Boot (future session).
- `web/` — web app (future session).

**Flat** root: no `apps/`, no shared `packages/`. The modules are siblings at
the root; the question only reopens once there is shared code.
