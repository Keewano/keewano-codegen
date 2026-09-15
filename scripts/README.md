# scripts

Seven checks and two build steps. `check-determinism.sh` and `build-binaries.cjs`
run in the pipeline as part of `npm run build:ci`; the other six need Docker or a
checkout of another SDK, so they run on demand.

The checks share one rule: a run that verified nothing exits non-zero.
Reporting "skipped" and returning success is the failure they were written to
avoid, so `KEEWANO_ALLOW_SKIP=1` is the only way to accept an unverified run,
and it has to be typed on purpose.

It waives only what this repository cannot supply itself - a checkout of another
SDK, a toolchain image - and never a claim it can check on its own, such as
which package the recorded vectors declare. It also never waives a _typo_: an
override variable that does not resolve is a mistake somebody made on purpose,
so it fails whatever the flag says.

## check-determinism.sh

`npm run check:determinism`, and part of `npm run build:ci`. Generates every
recorded vector twice and compares run against run, then run against the
recorded file. The first comparison catches anything nondeterministic that
happened to match the recording once - a gzip build that stopped honouring the
pinned level, a header byte that stopped being normalized. The second catches
drift.

It drives the built CLI, not the sources, so it refuses to run against a `dist/`
older than the files it came from: comparing a stale generator with itself would
report the change byte-clean without ever executing it, which is the failure the
check exists to catch.

Which targets it covers comes from the recorded vectors themselves, including
which of them write a second artifact - so a new emitter is covered the moment
its expected files land, with nothing here to update.

Every vector also goes through the standalone executable for this machine and is
compared against the recording. That executable carries its own runtime, so it is
a second implementation path rather than the same one in a wrapper, and this is
the only check that judges it. The cross-compiled builds for other platforms
cannot run here and are not covered.

Finding no executable for this host is a failure, not a skip: the pipeline builds
them two steps earlier, so a host this repository publishes no build for stops
the run rather than reporting a pass it did not earn. A local run that has not
built them types `KEEWANO_ALLOW_SKIP=1`. An executable that is present but older
than `dist/` stops the run too - presence says nothing about the build behind it,
which is the same reason a stale `dist/` is refused.

## check-native-vectors.sh

`npm run check:native`. Runs the recorded Swift, Kotlin and Python vectors
against the surfaces in `conformance/__sdk-surfaces/`, using Docker
(`swift:6.0.3`, `zenika/kotlin:1.4.20`, `python:3.8-slim` - pinned, because a check whose claim is that one input
gives one output cannot rest on a tag somebody else can move). The TypeScript vectors get the same treatment for free
through `npm run typecheck`; the native toolchains are gigabyte images, so this
one runs on demand instead.

Three things it does deliberately:

- The verdict is the compiler's exit status, never a match on its output. A
  rejected Swift file can be described entirely in `note:` lines - an unclosed
  brace is - and grepping for `error:` called that a pass.
- Swift is checked in language mode 5 and again in mode 6, because the generated
  file lands in the customer's target, whose mode this package does not choose.
  Mode 6 is expected to fail: the SDK's set type is not `Sendable`, which makes
  the generated `static let` a concurrency error. That expectation is pinned, so
  the day the SDK gains `Sendable` the check says so and fails, rather than
  staying quiet about a fixed problem.
- Kotlin compiles against the surface the Android SDK published in its
  codegen contract: the `KeewanoCodegen` bridge and the `KeewanoSDK` object
  the reporters extend. `npm run check:surfaces` keeps the stub aligned
  with that checkout.

## check-reserved-names.cjs

`npm run check:reserved`. Reads the public `report*` surface out of each SDK
checkout and fails on a name that is public there and missing from
`RESERVED_EVENT_NAMES`.

The guard exists because no compiler can do this job. A custom event named like
a built-in generates a wrapper that shadows it, and that wrapper is legal code:
measured in Swift, an extension declared in another module compiles without a
warning and wins the call, so the built-in event stops being reported. The list
is the only thing standing between a customer and that silence, which is why it
is compared against the SDKs instead of being trusted.

A surface that yields almost no methods is an error, not a
surface without methods: the patterns anchor on the indentation of a public
member, so a reformat upstream would otherwise make the check quietly stop
reading a whole SDK.

## The four surface checks

`npm run check:surfaces` runs all of them through `check-surfaces.cjs`: chaining
them in the npm script let the first failure hide the rest, so a missing iOS
checkout skipped every other comparison and the run still looked like one check
failing. They compare the surfaces in `conformance/__sdk-surfaces/` against the
declarations the SDKs publish. One file per SDK, because they compare different
things: iOS carries the definition set inside the generated source, Android reads
it from a JSON asset at launch, Python exposes a bridge module, and TypeScript
declares the set as a type the generated module annotates against.

| Check                          | SDK        | On a difference |
| ------------------------------ | ---------- | --------------- |
| `check-sdk-surfaces.cjs`       | iOS        | fails           |
| `check-android-surface.cjs`    | Android    | fails           |
| `check-python-surface.cjs`     | Python     | fails           |
| `check-typescript-surface.cjs` | TypeScript | prints          |

Three of them fail on anything our surface claims that upstream does not have.
The TypeScript one only reports, in both directions, and that is deliberate: the
emitter is meant to write a field before the SDK declares it, so failing on the
difference would block this repository on the other one merging. What was missing
there was not a gate but a statement, so each difference is named along with the
commit it was measured against. A run that compared nothing still fails, exactly
as the other three do.

Without them the other check is circular in one direction: compiling the vectors
proves they agree with those files, and nothing proved the files still agree
with the SDKs, so a rename upstream would leave a green run over a generated
file no customer can build.

The iOS and Android checks also compare the entry point - the type every
generated reporter is an extension on. That name is read out of the SDK and
looked for in a recorded vector, so what is compared is our own output against
upstream rather than one transcription against another. It is the half a rename
breaks first: a file full of correct bridge calls still does not build if the
type it extends is gone.

What each pins beyond the bridge overloads:

| Check                          | Also compared                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `check-sdk-surfaces.cjs`       | the set's public properties and initializers, and `extension KeewanoSDK`                  |
| `check-android-surface.cjs`    | the asset name the SDK looks up at launch, the fixed generated package, `fun KeewanoSDK.` |
| `check-python-surface.cjs`     | the `from_gzip_base64` constructor, and the import line the vectors write                 |
| `check-typescript-surface.cjs` | the fields of the set and of one event entry, each difference named with its direction    |

They compare declarations rather than building, because building the real iOS
SDK needs macOS and the real Android module needs Gradle and the Android
framework. The end-to-end check belongs in those repositories; this is what can
be done from here, and it is the difference between a transcription and a
comparison.

## find-upstream.cjs

Not a check: the piece the SDK checks use to locate a declaration in another
repository.

Folder names are a property of one machine. A checkout called `the iOS SDK`
here is called something else on the next desk, and a check that hardcodes the
name passes or fails for reasons that have nothing to do with the code. What is
matched instead is the path a declaration carries **inside its own repository**,
which is a fact about the SDK rather than about this filesystem.

Where it looks, in order of how much the caller meant it:

| Setting                                                                          | Effect                                                                                                                        |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `KEEWANO_IOS_SDK`, `KEEWANO_ANDROID_SDK`, `KEEWANO_TS_SDK`, `KEEWANO_PYTHON_SDK` | that file, or the checkout containing it. An override that does not resolve is an error, never a quiet fall back to searching |
| `KEEWANO_SDKS_DIR`                                                               | the one directory to search. Named by the caller, so it is the whole answer, not a hint                                       |
| neither                                                                          | the directory this repository sits in                                                                                         |

Nothing is guessed silently: when a search comes up empty, the failure names
every place it looked.

## build-binaries.cjs

`npm run build:binaries [name-fragment]`, and part of `npm run build:ci`.
Compiles the CLI into a dependency-free executable for Linux, macOS (Intel and
Apple silicon) and Windows, into `binaries/`.

This is what makes build-time generation possible on iOS. An SPM build-tool
plugin and a CocoaPods script phase run the generator on the app developer's
machine, and neither can assume a Node install that developer never made. The
same executable serves Android and Python developers.

Every platform is produced from whichever machine runs the script, so one build
covers all four rather than needing a runner each. That costs network: npm installs the runtime
for this machine only, and the compiler fetches the other three from the npm registry the first
time it needs them, around 200 MB in total. A runner with no egress there fails the build rather
than falling back, and `build:ci` stops before the determinism check. A name fragment builds only
the matching targets, which is what a local run wants: proving a change to the
generator still compiles needs one of them, not four.

It compiles `bin/keewano-codegen.cjs`, the same entry npm installs, which is why
that file loads the CLI through literal specifiers. A compiler cannot follow an
indirect one, and written any other way it packs the shim alone: an 85 MB
executable that answers every invocation with its own build being missing, from a
build that reported success and a size a megabyte off the real one. Nothing about
compiling says so, so the shim tests pin the specifiers instead.

## pack-local.cjs

`npm run pack:local -- <directory>`. Packs the CLI and drops the tarball where a
local project can install it from, months before anything is published.

A project that installs the tarball resolves the package, reads the `files`
list and runs the bin shim exactly as a customer will. Pointing a test harness
at the working tree instead proves the source works and says nothing about the
package - which is how a duplicated schema and a bin shim that answered a
missing build with a loader stack both survived until someone installed it.

The destination is an argument, never a constant: where anyone else keeps their
checkouts cannot be known from here. The SDK test environments already consume
the SDK packages this way, so a harness adds one dependency and calls
`keewano-codegen` from `node_modules/.bin` like any other tool.

## lib/

The pieces the checks share, each moving for its own reasons:

| File                 | Holds                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `ownFile.cjs`        | reading a file this repository owns, failing with its name and what it was wanted for                                           |
| `entryPoint.cjs`     | comparing the type the generated reporters extend against the SDK that declares it                                              |
| `signature.cjs`      | comparing two declared signatures - by type for a positional caller, by label for a Swift one                                   |
| `reportSurfaces.cjs` | where each SDK publishes its public `report*` API and how a public member is spelled there - six surfaces across four checkouts |
| `androidAsset.cjs`   | the other half of the Android contract: the asset name the SDK looks up and the three keys it reads                             |
| `hostBinary.sh`      | which standalone executable this machine can run, and the comparison that proves it emits the recorded bytes                    |
| `compile.sh`         | running a compiler in a container and reporting what happened, for check-native-vectors.sh                                      |
