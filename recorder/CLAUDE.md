# recorder — architecture guide

vigia's recorder (Node/TS). Hexagonal architecture. This guide answers "where does my code
live?" and is the module's architecture reference. The _definition of done_ is the root one
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
  never `Repository` (the recorder only _appends_, never queries history).
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

| Port              | Hides                                | Role                                |
| ----------------- | ------------------------------------ | ----------------------------------- |
| `SegmentArchive`  | R2 / S3-compatible upload            | output gateway (archive blob)       |
| `SegmentRegistry` | REST (phase C) / no-op (phase A)     | output gateway (register existence) |
| `Encoder`         | ffmpeg subprocess                    | mechanism                           |
| `SegmentSource`   | watching the `.m3u8` playlist        | mechanism                           |
| `CameraConfig`    | local file (phase 1) / API (phase 2) | config provider                     |
| `Clock`           | system clock                         | mechanism (testable time)           |
| `Logger`          | JSON / journald                      | mechanism                           |

`application/ports/` holds **only** behavior contracts implemented by an infrastructure
adapter. Errors go to `application/errors/`, data shapes crossing a port go to
`application/commands/`. Enforced as far as the tool allows by the dependency-cruiser rule
`ports-are-type-only`: nothing may import `application/ports/**` as a runtime value, so no
concrete class can usefully live there.

Because `application/errors/` sits in `application`, `domain` cannot throw those errors: an
entity/VO throws a plain `Error`/`RangeError` and the adapter (or use case) wraps it in the
application error.

`Encoder` and `SegmentSource` are abstracted **separately** on purpose: today both are the
same ffmpeg (one produces `.ts`, the other notices via `.m3u8`), but the core must not know
about that coupling — only the infra adapter knows.

In **phase A** the composition root injects `NoopRegistry` (confirms immediately); in
**phase C** it swaps to `RestRegistry` without the use case changing a single line.

## Configuration (environment)

Every camera value that changes per deployment enters through **one door**: `cameraValues(env)`
in `infrastructure/container.ts`. **There are no defaults** — a missing or blank variable is a
`ConfigValidationError` and the process exits non-zero before touching disk or spawning
anything. Nothing outside the composition root reads `process.env`.

| Variable                   | Field                    | Expected                                       |
| -------------------------- | ------------------------ | ---------------------------------------------- |
| `RECORDING_DIR`            | `recordingDir`           | absolute path, writable by the recorder's user |
| `RTSP_URL`                 | `rtspUrl`                | full `rtsp://` URL, **credentials included**   |
| `SEGMENT_DURATION_SECONDS` | `segmentDurationSeconds` | positive integer (600 in production)           |
| `PLAYLIST_FILENAME`        | `playlistFilename`       | file name only, no path separator (`.m3u8`)    |

`.env.example` is the contract and is git-tracked; `.env` holds the real values and is
git-ignored — **credentials never get committed**. Both `pnpm run start` and `just dev` load it
via Node's native `--env-file-if-exists=.env` (no dotenv dependency); a variable already
exported in the shell **wins** over the file — which is how a single run is overridden:
`RECORDING_DIR=/tmp/rec just dev`, with no Justfile support needed.

Keep `RECORDING_DIR` **outside** the module tree in production. When it points inside it (the
devcontainer default `.recordings/`), the recorded `.ts` segments collide with TypeScript
sources: `.gitignore`, `.prettierignore` and the eslint `ignores` all have to exclude it, or
`just check` fails trying to parse video as code.

`cameraValues` takes `env` as a parameter precisely so the tests never mutate the global
`process.env`. Range and format rules (positive duration, absolute path, `rtsp://` scheme) stay
in the **domain** — the container only checks presence and converts the string.

`Camera.DEFAULT_SEGMENT_DURATION` (600s) is **not** used by this path: it is the default
published to configuration sources that omit the value, and it survives for when the config
comes from the API instead of the environment.

## Capture decisions (ffmpeg adapter)

Recorded against the reference camera (Yoosee/ONVIF), in `ffmpeg-subprocess.ts`:

- **`-rtsp_transport udp`** — the camera answers `SETUP` with a non-matching transport when TCP
  is requested (`Nonmatching transport in server reply`); it does not support RTSP interleaved
  over TCP. The cost is UDP packet loss, which `-c copy` writes straight into the segments.
- **`-an`** — the camera's audio is `pcm_alaw`, which has no MPEG-TS tag: copied into the
  playlist it lands as an unplayable `bin_data` stream. Dropping it keeps RNF-002 (zero
  re-encode) intact.

Both are hardcoded for a single known camera. When a second camera model shows up, they become
adapter configuration — not domain vocabulary.

## Naming convention

- File in **kebab-case** = the kebab version of the class name (PascalCase). **One file per
  class.**
- Acronyms become lowercase joined, not separate segments: `R2Archive` → `r2-archive.ts`,
  `RestRegistry` → `rest-registry.ts`, `JsonLogger` → `json-logger.ts`.
- Files with no class are a single word: `container.ts`, `main.ts`.
- A class file holds the class and the types that are its contract — nothing else. Constants,
  helper functions and default seam implementations belong **inside** the class as
  `private static`, so the class starts within a few lines of the imports and every declaration
  has an owner. Types are the stated exception only because TypeScript cannot nest them: an
  `interface`/`type` stays above the class.

## Folder map

    src/
      domain/
        entities/         # Camera, Segment, RecordingSession (aggregate root)
        value-objects/    # StorageKey, Duration, TimeRange
      application/
        ports/            # the 7 interfaces above, named by intent
        commands/         # data shapes crossing a port (EncoderCommand)
        errors/           # application-level errors (ConfigValidationError)
        usecases/         # one class per case (ProcessClosedSegment, StartRecording, …)
      infrastructure/     # adapters (per port) + container.ts + main.ts
    tests/
      unit/               # no I/O at all — each bucket mirrors src/ folder for folder
        domain/
          entities/
          value-objects/
        application/
          commands/
          usecases/
        infrastructure/
          config/
          encoder/
      integration/        # touches the real filesystem
        infrastructure/
          storage/
      e2e/                # spawns the recorder as a real process
        infrastructure/
      fakes/              # FakeEncoder, FakeArchive, FakeClock, … (shared, no src/ counterpart)

## Module resolution

Relative imports carry **no extension** — `'../value-objects/duration'`, never
`'../value-objects/duration.js'`. That is enabled by `moduleResolution: "bundler"` with
`module: "preserve"` in `tsconfig.json`, and it holds because **nothing here is ever emitted**
(`noEmit: true`): `tsx` runs the sources in production (`pnpm run start`) and vitest runs them
in tests. Both resolve extensionless specifiers; raw Node ESM does not.

The constraint that comes with it: **the day this module gets a real build (`tsc` emitting JS)
or drops `tsx` for Node's native type stripping, every relative import needs its extension
back** — Node's ESM resolver never guesses extensions. That is a mechanical `sed`, and it is the
price paid for not writing `.js` next to a `.ts` file.

Path aliases via the `package.json` `imports` field (`#domain/...`) were evaluated and
**rejected**: dependency-cruiser cannot resolve them, and it reports "no dependency violations"
anyway — the architecture rules would go blind without failing. Any future aliasing scheme must
be validated against `just check` with `--output-type json`, confirming zero `couldNotResolve`.

## Test buckets

Three buckets, split by **the external resource a test needs** — never by layer, which is
already what the mirror expresses. Infrastructure is not a synonym for integration:
`ffmpeg-subprocess` and `container` are unit tests, because the spawn seam and the `env` are
injected.

| Bucket        | Needs                   | Verb                    |
| ------------- | ----------------------- | ----------------------- |
| `unit`        | nothing — in memory     | `just test-unit`        |
| `integration` | the real filesystem     | `just test-integration` |
| `e2e`         | a real recorder process | `just test-e2e`         |

`just test` runs all three and is what the definition of done requires. **`tests/<bucket>/`
mirrors `src/` folder for folder**: the test for `src/<layer>/<folder>/<name>.ts` lives at
`tests/<bucket>/<layer>/<folder>/<name>.test.ts`. `tests/fakes/` is shared by every bucket and
has no `src/` counterpart.

Anything needing the camera, the network or a real ffmpeg does **not** belong in these three —
it is manual QA today. When it gets automated (a local RTSP server as the source), it earns its
own bucket, kept out of the default feedback loop.

## Exemplar

The module's canonical exemplar is the config provider slice (task A1):

- `src/infrastructure/config/hardcoded-camera-config.ts` — the reference adapter: implements a
  port, holds the technology/source vocabulary, and translates domain construction failures into
  `ConfigValidationError(scope, field, reason)` with the field decided at the wrap site.
- `src/infrastructure/container.ts` / `src/infrastructure/main.ts` — the composition root and the
  fail-fast entrypoint (invalid configuration exits non-zero before anything else starts).
- `tests/unit/infrastructure/config/hardcoded-camera-config.test.ts` and
  `tests/e2e/infrastructure/main.test.ts` — one acceptance test per Gherkin scenario.

Imitate that slice: no comments and no JSDoc anywhere (names and test names carry the meaning),
ports imported as types only, one file per class, and the test placed in the bucket that matches
the resource it needs (see **Test buckets**).

## Test naming

A test name describes the **observable behavior**, and nothing else.

**Never prefix it with requirement identifiers** — no `US-001/RF-002:`, no `RNF-002`, no
`DC-003`. Those identifiers belong in `docs/specs/`, which is where they can be kept correct;
copied into a test name they rot silently, add noise to every runner report, and say nothing
about what broke when the test goes red. The traceability they were meant to give comes from the
spec pointing at the behavior, not from the code pointing back at the spec.

    ✗ it('US-001/RF-003/RNF-002: derived command performs stream copy with no re-encode')
    ✓ it('derived command performs stream copy with no re-encode')

The `describe` names the unit under test (`Camera`, `FfmpegSubprocess`, `encoderCommandFor`) or
the behavior slice (`recorder startup`), never a requirement.
