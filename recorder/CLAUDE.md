# recorder — architecture guide

vigia's recorder (Node/TS). Hexagonal architecture. This guide answers "where does my code
live?" and is the module's architecture reference. The *definition of done* is the root one
— see [`../CLAUDE.md`](../CLAUDE.md).

## Dependency rule (the invariant)

    infrastructure → application → domain

Always pointing **inward**:

- `domain` imports **nothing** from outside itself.
- `application` imports **only** from `domain` (never from `infrastructure`).
- Only `infrastructure` knows concrete technology names (ffmpeg, R2, REST, Postgres, fs).

Enforced by **dependency-cruiser** (`.dependency-cruiser.cjs`) with the named rules
`domain-is-pure`, `application-inward-only`, `no-circular`, **plus** the forbidden-vocabulary
grep (`ffmpeg` in `domain`/`application` must return empty). Both run in `just check`.

## Where does my code live?

- **Business rule** (watchdog, backoff, deterministic key)? → **behavior of an
  entity/VO** in `domain`. E.g. `RecordingSession.isEncoderStale(now)`,
  `.nextRetryDelay()`, `StorageKey.for(camera, segment)`. **There is no `services/` folder** —
  no behavior is left orphaned from an entity/VO.
- Does it have **identity / lifecycle**? → `domain/entities/` (`Camera`, `Segment`,
  `RecordingSession`). Is it an **immutable value** compared by content? → `domain/value-objects/`
  (`StorageKey`, `Duration`, `TimeRange`).
- Does it **orchestrate the cycle** (sacred order, reconnection, supervision)? →
  `application/usecases/`, **one class per case**, declaring in the constructor exactly the
  ports it uses. E.g. `ProcessClosedSegment` (archive → register → delete).
- Does it need to **talk to the world**? → a **port** (interface) in `application/ports/`,
  named **by domain intent**, not by the technology it hides. Outputs are **gateways** —
  never `Repository` (the recorder only *appends*, never queries history).
- Does it know **ffmpeg / R2 / REST / Postgres / fs**? → `infrastructure/`, implementing a
  port. **Technology vocabulary only here.**
- **Wiring** port→adapter? → `infrastructure/container.ts` (single composition root, the only
  place that knows both ports **and** adapters). Entrypoint → `infrastructure/main.ts`.

## Rich-domain discipline

The entity **receives** external inputs as **parameters** (e.g. `isEncoderStale(now)`) —
**never** reads `Clock` or any I/O from within. The `Clock` port is read in the use case and
the instant is passed onward. That is what keeps the test deterministic: you can test
"13 min with no segment" without waiting 13 minutes.

## Ports (`application/ports/`)

| Port | Hides | Role |
|---|---|---|
| `SegmentArchive`  | R2 / S3-compatible upload          | output gateway (archive blob) |
| `SegmentRegistry` | REST (phase C) / no-op (phase A)   | output gateway (register existence) |
| `Encoder`         | ffmpeg subprocess                  | mechanism |
| `SegmentSource`   | watching the `.m3u8` playlist      | mechanism |
| `CameraConfig`    | local file (phase 1) / API (phase 2) | config provider |
| `Clock`           | system clock                       | mechanism (testable time) |
| `Logger`          | JSON / journald                    | mechanism |

`Encoder` and `SegmentSource` are abstracted **separately** on purpose: today both are the
same ffmpeg (one produces `.ts`, the other notices via `.m3u8`), but the core must not know
about that coupling — only the infra adapter knows.

In **phase A** the composition root injects `NoopRegistry` (confirms immediately); in
**phase C** it swaps to `RestRegistry` without the use case changing a single line.

## Naming convention

- File in **kebab-case** = the kebab version of the class name (PascalCase). **One file per
  class.**
- Acronyms become lowercase joined, not separate segments: `R2Archive` → `r2-archive.ts`,
  `RestRegistry` → `rest-registry.ts`, `JsonLogger` → `json-logger.ts`.
- Files with no class are a single word: `container.ts`, `main.ts`.

## Folder map

    src/
      domain/
        entities/         # Camera, Segment, RecordingSession (aggregate root)
        value-objects/    # StorageKey, Duration, TimeRange
      application/
        ports/            # the 7 interfaces above, named by intent
        usecases/         # one class per case (ProcessClosedSegment, StartRecording, …)
      infrastructure/     # adapters (per port) + container.ts + main.ts
    test/
      domain/             # rich rules, no fakes
      application/        # use cases against fakes
      fakes/              # FakeEncoder, FakeArchive, FakeClock, …

## Exemplar

The module's canonical exemplar does **not exist yet** — it will be **task A1**
(`CameraConfig` / config provider, the first real `.ts`), built with this same tooling. Until
then, this guide is the reference. (Update this section when A1 is born.)
