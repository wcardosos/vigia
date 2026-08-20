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

## Environment variable naming

Vale para **todo módulo** — recorder hoje, `api/` e `web/` quando chegarem. O contrato de cada
módulo (quais variáveis, o que cada uma espera) mora no `CLAUDE.md` dele; aqui ficam as regras
que decidem o **nome**.

1. `UPPER_SNAKE_CASE`, ASCII, `[A-Z][A-Z0-9_]*`. Underscore simples sempre; `__` nunca — é
   artefato de _relaxed binding_ de framework, e o parser é nosso.
2. Prefixo **`VIGIA_`** em tudo que é do projeto. A exceção é fechada: nomes que são convenção
   genuína do ecossistema e não são nossos — `NODE_ENV`, `TZ`. `LOG_LEVEL` é nosso, logo
   `VIGIA_LOG_LEVEL`.
3. Formato `VIGIA_<GRUPO>_<CHAVE>`, e **grupo se conquista**: só existe com dois ou mais membros
   _e_ quando desambigua de fato. Sem grupo decorativo, sem grupo profético — um grupo de um
   membro só vira rename barato no dia em que o segundo aparecer.
4. **O sufixo declara tipo e unidade**: `_URL`, `_DIR`, `_FILE`/`_FILENAME`, `_SECONDS`, `_MS`,
   `_BYTES`, `_ENABLED`, `_COUNT`. Duração nunca sem unidade no nome.
5. **Nome de tecnologia é permitido** — env é configuração de `infrastructure`, a única camada
   autorizada a conhecer ffmpeg, S3 e REST. Mas o nome descreve o **contrato**, não o vendor:
   `S3`, nunca `R2`.
6. **Namespace próprio vence nome de vendor**: `VIGIA_S3_ACCESS_KEY_ID`, nunca
   `AWS_ACCESS_KEY_ID` — mesmo sendo o que o SDK leria sozinho. A escolha existe para que o
   composition root seja o **único leitor de configuração** do processo; a contrapartida é que o
   client tem que receber as credenciais explicitamente no construtor, senão a _default
   credential chain_ procura `AWS_*`, `~/.aws/credentials` e metadata de instância — e pode
   achar, autenticando na conta errada sem erro nenhum.
7. **Variável obrigatória não tem default.** Ausente ou vazia → falha na inicialização com exit
   não-zero, antes de tocar disco ou subir subprocesso.

## Modules

- `recorder/` — recorder, Node/TS. See [`recorder/CLAUDE.md`](recorder/CLAUDE.md).
- `api/` — Java/Spring Boot (future session).
- `web/` — web app (future session).

**Flat** root: no `apps/`, no shared `packages/`. The modules are siblings at
the root; the question only reopens once there is shared code.
