# Contributing to @keewano/codegen

How the generator is extended and how it is checked. None of this ships in
the published package - it is here for anyone working on the tool itself.

## Adding a language

Two halves, and only the first lives in this repository.

**The emitter (here).** One file (or folder) under `src/emitters/`, implementing
both members of `Emitter` - `emit({ events, built })`, which renders the file,
and `reporterNameFor(name)`, which says what identifier this target declares for
an event of that name. The second is what the collision guards compare, so a
target whose spelling is many-to-one is caught rather than silently merging two
events. Plus one entry in `src/emitters/registry.ts` and the new name in the
`EmitTarget` union. An emitter
receives the parsed events and the already-built set; it renders text and never
touches bytes or hashes. Record the expected file per target under
`conformance/*/expected/` and both the test suite and the determinism check
pick it up from the registry. Budget: about a day.

**The seam (in the SDK).** The SDK needs a way to receive the set and a bridge
the generated wrappers call:

- a `CustomEventSet` type with `version`, `eventCount` and `gzipData`,
  which are already identical across TypeScript, Kotlin and Python, plus
  the `events` list the TypeScript emitter writes beside them so a
  by-name bridge can resolve a name without decoding the map;
- a public `reportCustomEvent` bridge the wrappers forward to - by name in the
  TypeScript SDKs (`reportCustomEvent({ name, value })`), by wire id in the
  native Kotlin and Swift SDKs (`reportCustomEvent(id, value)`) - validating
  ranges the way the built-in reports do (uint32, ushort bounds, string
  truncation) so wrappers stay dumb;
- a way to hand the set to the SDK: an optional parameter on the SDK's init call
  (`Keewano.init({ apiKey, customEventSet })` in TypeScript), so the generated
  file lives in the customer's project and the SDK can ship as a package.

## Development

```bash
npm ci
npm run lint && npm run format && npm run typecheck && npm run build && npm run test:cov
```

`src/` is arranged by feature, and the features form layers that only point
down; lint enforces the arrows, so a seam leak fails the build:

```
shared/     pure utilities (errors, errno, JSON reading)
events/     the event model and the definitions file on disk
set/        the frozen contract: map bytes -> gzip -> normalize -> FNV-1a
emitters/   one template per language, the registry, the manifest
watch/      the --watch loop, without knowing what a run is
cli/        argv, settings, usage, exit codes, run
```

Each feature keeps its own `types/` (the Args and result interfaces) and its
tests in `__tests__/` next to the units, with the fixtures the tests need under
`__tests__/helpers/`. Import order is also a lint rule (`npm run lint:fix`
applies it). Coverage thresholds are 95 / 90 / 95 / 95 (statements / branches /
functions / lines). CI runs format, lint, build and coverage through the shared
Node builder, and `npm run check:determinism` generates every recorded vector
twice and diffs the runs against each other and against the recorded bytes.

A few suites need a capability the platform may not have - creating a symbolic
link, two file names differing only in case, and permission bits that survive a
write - and they report as skipped where it is missing. The runner has all
three, and the probe fails the build under CI if it ever does not, so a skip is
a local convenience and never a way for a case to go unrun.

### The four checks CI cannot run

`check:surfaces` and `check:reserved` compare this package against the SDK
repositories; `check:native` compiles the recorded vectors in Docker, and
`check:wrappers` drives the Gradle and SPM wrappers there. The pipeline has
neither the checkouts nor a daemon, so none of the four runs there, and nothing
makes them run anywhere on its own:

```bash
npm run check:surfaces   # the SDK surfaces this package writes against
npm run check:reserved   # RESERVED_EVENT_NAMES against every public report* API
npm run check:native     # every recorded vector, compiled or executed
npm run check:wrappers   # the Gradle and SPM wrappers against a recorded vector
```

Run them when an emitter changes, when a surface file under
`conformance/__sdk-surfaces/` is edited, and before a release. The dates in
those files record when each was last compared by hand; a check whose checkout
is missing exits non-zero unless `KEEWANO_ALLOW_SKIP=1` says an unverified run
is wanted, and the verdict now names the checkout and revision it read, so a
clone that is simply behind cannot read as an upstream removal.

Moving them into a scheduled pipeline with the SDK repositories cloned is the
obvious next step and is not done here.
