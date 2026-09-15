# Conformance vectors

Recorded input and output for the generator: a definitions file, the
exact file every target is expected to produce from it, and the version stamp
the set is expected to hash to. The generator depends on no SDK by design, so
these vectors are the cross-check that its encoder still agrees with the one
the SDKs already ship.

## Layout

```
conformance/
  __sdk-surfaces/     what a generated file is allowed to use, per language
  empty-set/          corpus: no events at all
  many-events/        corpus: ten events
  single-event/       corpus: one event
  sort-order/         corpus: names whose order differs between natural and code-unit sorting
  tsconfig.json       compiles the TypeScript vectors and the surfaces together
  versions.json       version and event count per corpus
```

A corpus is a folder with `input/` in it, holding the definitions file under
the tool's default name. Both consumers apply that one rule - the test suite in
`src/emitters/__tests__/conformance.test.ts` and `scripts/check-determinism.sh`
- so a folder placed here that is not a corpus is skipped instead of being
generated from.

```
<corpus>/
  input/
    keewano.events.json        the definitions file
  expected/
    react-native.generated.ts
    expo.generated.ts
    node.generated.ts
    web.generated.ts
    kotlin.generated.kt
    kotlin.generated.asset.json
    swift.generated.swift
    python.generated.py
```

## Where the expected files come from

Nobody writes them. Each one is the CLI's own output for that corpus:

```
node bin/keewano-codegen.cjs \
  --input conformance/<corpus>/input/keewano.events.json \
  --target <target> --code <scratch directory>
cp <scratch directory>/<the one file there> conformance/<corpus>/expected/<target>.generated.<ext>
```

The generator names the file it writes, so the run is handed a scratch
directory and the file is copied out of it under the vector's name: the target,
then the extension the generated file takes. `kotlin` records a second artifact
- the definition-set asset, written into the directory `--asset` names and
copied to `expected/kotlin.generated.asset.json`.

The recorded set is discovered from the files, not from a list: one vector per
registered target, and a target with no vector - or a vector with no target -
fails the suite. A new emitter is covered the moment its expected files land.

## What is frozen and what is a snapshot

`versions.json` is each set's identity for the input it was recorded from.
While the input files stay as they are, the stamp is never re-recorded: a
failing version means the code changed the wire contract, so the code is what
gets fixed.

The `expected/` files are rendering snapshots. A deliberate template change
re-records them in the same commit, and the untouched version stamps are the
proof that only the rendering moved.

## __sdk-surfaces

The generated files import the SDK they were generated for, so something has to
declare that API or the vectors are unbuildable text. That is what this folder
holds: `sdk-modules.d.ts` for the four TypeScript targets, and one file each
for the three that are not - `KeewanoSDK.swift`, `KeewanoSDK.kt` and
`keewano_sdk.py`.

These are written by hand and cannot be generated. Producing them from a real
SDK would mean depending on one at build time, which is the coupling this
package refuses - and it would also turn the vectors into a tautology. They
describe only what a generated file is allowed to use, so a vector that called
something else stops compiling.

| Vectors | Compiled by | When |
|---|---|---|
| react-native, expo, node, web | `tsc`, through `tsconfig.json` here | every `npm run typecheck` |
| swift | `swiftc` in Docker | `npm run check:native`, on demand |
| kotlin | `kotlinc` in Docker | `npm run check:native`, on demand |
| python | imported and called in Docker | `npm run check:native`, on demand |

The native check runs on demand because the toolchains are large images. It
proves the generated code is valid and well formed against the surface as
written down here. On its own that would be circular - a rename upstream would
leave these files compiling against a surface no SDK still has - so
`npm run check:surfaces` reads the declarations out of the SDK checkouts and
fails on anything this folder claims and they do not, the entry point the
reporters extend included. It compares declarations rather than building: the
real build needs macOS for iOS and Gradle for Android, so the end-to-end check
belongs in those repositories.

One thing it can never prove, so the guard lives elsewhere: a generated wrapper
that shadows a built-in `report*` method is legal code. Measured in Swift, an
extension declared in another module compiles without a word and wins the call,
which means the built-in event silently stops being reported. `RESERVED_EVENT_NAMES`
rejects those names at parse time, and `npm run check:reserved` compares that
list against the public surface each SDK checkout actually ships.

## What CI checks

`scripts/check-determinism.sh` generates every vector twice and compares run
against run - catching any ordering or timestamp that leaked into the output -
and then run against the recorded file, catching drift. Both have to match. It
runs in the pipeline as part of `npm run build:ci`, and `npm run check:determinism`
reproduces it locally - after `npm run build:binaries`, because it also drives
the standalone executable for this host and refuses to report a pass without one.

## Adding a corpus

Create the folder with `input/keewano.events.json`, generate one expected file
per registered target - two for `kotlin`, which also records its definition-set
asset - add the version and event count to `versions.json`, and cross-check
that stamp against a generator that already implements the contract before
committing it. Nothing else needs editing: discovery is by folder shape.
