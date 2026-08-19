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

Every value that changes per deployment enters through **one door**: `Env.load(source)` in
`infrastructure/env.ts`, called exactly once, from `main.ts`. **There are no defaults** — a
missing, blank or malformed variable is an `EnvValidationError` and the process exits non-zero
before touching disk or spawning anything. `Env` reads no I/O and no global: `load` takes the
source as a parameter, so "`VIGIA_S3_BUCKET` is missing" is tested with an object literal.

`Env` lives at the root of `infrastructure`, next to `container.ts` and `main.ts` — **not** in
`config/`, which is reserved for port adapters. It implements no port; it is the composition
root's companion. Its Zod schema is **private to the file**: exporting it would let the coupling
back in through the side door.

The accessors carry a group only where the variable name already has one — today `s3` is the
only earned group: `env.rtspUrl`, `env.recordingDir`, `env.segmentDurationSeconds`,
`env.playlistFilename`, `env.s3.{endpoint,bucket,accessKeyId,secretAccessKey}`. `env.s3` is a
frozen object, ready to be handed whole to the adapter's constructor.

| Variable                         | Field                    | Expected                                       |
| -------------------------------- | ------------------------ | ---------------------------------------------- |
| `VIGIA_RTSP_URL`                 | `rtspUrl`                | full `rtsp://` URL, **credentials included**   |
| `VIGIA_RECORDING_DIR`            | `recordingDir`           | absolute path, writable by the recorder's user |
| `VIGIA_SEGMENT_DURATION_SECONDS` | `segmentDurationSeconds` | positive integer (600 in production)           |
| `VIGIA_PLAYLIST_FILENAME`        | `playlistFilename`       | file name only, no path separator (`.m3u8`)    |

The archive credentials come from the same door, under the `s3` group: `VIGIA_S3_ENDPOINT`
(`https://`, **without the bucket in the path**), `VIGIA_S3_BUCKET`, `VIGIA_S3_ACCESS_KEY_ID`,
`VIGIA_S3_SECRET_ACCESS_KEY`. They are passed **explicitly** to the `S3Client` constructor —
without that the SDK's default credential chain would look for `AWS_*`, `~/.aws/credentials` and
instance metadata, and could authenticate against the wrong account with no error at all.

The naming rules these names follow are repository-wide — see **Environment variable naming** in
[`../CLAUDE.md`](../CLAUDE.md). What they decide here: `S3` is a group because it has four
members that disambiguate, while `VIGIA_RTSP_URL`, `VIGIA_RECORDING_DIR`,
`VIGIA_SEGMENT_DURATION_SECONDS` and `VIGIA_PLAYLIST_FILENAME` stay group-less until a second
subsystem competes for the name — a `CAMERA_` group with a single member would be decorative.

**Known reopening point:** the backlog needs `camera_id` in two places — the deterministic S3 key
prefix (A6) and every structured log line (A7). Today the identity is the hardcoded `cameraA` in
`container.ts`. Whichever way it comes back (env, systemd's `%i`, or the last segment of
`VIGIA_RECORDING_DIR`), if it comes back as an environment variable then `CAMERA_` earns the
group again: `VIGIA_RTSP_URL` renames to `VIGIA_CAMERA_RTSP_URL` and `env.rtspUrl` becomes
`env.camera.rtspUrl`. That mechanical find-replace is the price accepted on purpose by "a group
is earned" — recognize it as a foreseen consequence, not as rework.

`.env.example` is the contract and is git-tracked; `.env` holds the real values and is
git-ignored — **credentials never get committed**. Both `pnpm run start` and `just dev` load it
via Node's native `--env-file-if-exists=.env` (no dotenv dependency); a variable already
exported in the shell **wins** over the file — which is how a single run is overridden:
`VIGIA_RECORDING_DIR=/tmp/rec just dev`, with no Justfile support needed.

Keep `VIGIA_RECORDING_DIR` **outside** the module tree in production. When it points inside it (the
devcontainer default `.recordings/`), the recorded `.ts` segments collide with TypeScript
sources: `.gitignore`, `.prettierignore` and the eslint `ignores` all have to exclude it, or
`just check` fails trying to parse video as code.

**Zod validates format; the domain validates rule.** `Env` turns `"600"` into `600` and rejects a
non-integer; what counts as a valid duration is still `Duration`'s call. Two Zod details that had
to become code: the schema is **not** `.strict()` (`process.env` carries hundreds of foreign
keys, so `Env` picks only the variables it declares), and an **empty string is treated as
absent** — `VIGIA_S3_BUCKET=` produces the same message as the variable not existing. `Env.load`
touches **no filesystem**: `VIGIA_RECORDING_DIR` is checked for being absolute, never for
existing or being writable — that check belongs to the encoder adapter's startup.

`Env.load` **throws** `EnvValidationError` carrying the complete list of problems; `main.ts`
catches it, writes to `stderr` and exits 1. The class knows nothing about `process.exit` —
lifecycle is the entrypoint's job, and that is what keeps it testable with no `process` stub.
Aggregation comes free from Zod and matters under `Restart=always`: three missing variables cost
one crash, not three. The message is assembled from the issue's **`path` plus our own text, never
Zod's raw `message`** — some issue types echo the value they received, and one of those values is
`VIGIA_S3_SECRET_ACCESS_KEY`.

Values stay plain `string`s; the protection lives in `Env`: `[util.inspect.custom]` and `toJSON`
return `"[REDACTED]"` for `s3.secretAccessKey` and `rtspUrl`, which covers `console.log(env)`,
`logger.info({ env })` and interpolating the whole object. The frozen `env.s3` carries the same
pair, otherwise `logger.info(env.s3)` would slip underneath. **What this deliberately leaves
open:** `logger.info({ url: env.rtspUrl })` still leaks — the redaction protects the object, not
the extracted field. The enforcement point for that stays the logger; `Env` shrinks the surface,
it does not close it.

Without an executable rule, "only `env.ts` reads `process.env`" is a convention that lasts until
the first shortcut. `no-restricted-properties` in `eslint.config.js` makes it verifiable inside
`just check`. Exactly two files are exempt: `env.ts`, which parses the source, and `main.ts`,
which hands it over. Everything else receives what it needs as a parameter.

The ffmpeg subprocess is the case that made the rule sharper. `FfmpegSubprocess` takes
`sourceEnvironment` in the constructor and does **not** forward it: it builds the child's
environment from an **allowlist** — `PATH`, because `execvp` resolves the binary using the
**child's** `PATH` — plus the `TZ` it sets itself. Nothing else crosses. `HOME`, `LANG`, proxy
variables and the whole `VIGIA_*` set (`VIGIA_S3_SECRET_ACCESS_KEY` included) stop being visible
in the encoder's `/proc/<pid>/environ` for no reason, and what the child gets is asserted in a
unit test instead of being whatever the runner happened to be started with. Adding a variable to
`INHERITED_VARIABLES` is a deliberate act, which is the point.

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
      infrastructure/     # adapters (per port) + env.ts + container.ts + main.ts
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
