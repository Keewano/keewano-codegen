# @keewano/codegen

Build-time generator for Keewano custom events. You describe every event once,
in one JSON file; the tool turns it into the generated module your SDK needs -
typed report helpers that look like the built-in API, plus the registration
payload the SDK sends to the backend. One tool serves every Keewano SDK; the
language differs, the event set and its hash do not.

## Installation

Two published packages, one on npm and one on PyPI, carrying the same generator.
The Gradle and Swift Package Manager wrappers in this repository are not
published.

```bash
npm install --save-dev @keewano/codegen
```

Node 20 or newer. The tool runs at development time only; nothing from this
package ships inside your application.

### From pip

A Python project has no Node, so it installs the same tool from PyPI instead:

```bash
pip install keewano-codegen
```

The wheel for your platform carries a self-contained executable, so nothing is
fetched afterwards and nothing is compiled. Every command and flag below is the
same either way - both packages run the same generator, and a project can keep
one definitions file and generate for several platforms from it.

### From Gradle - not published

**The Gradle plugin is not published.** It is
not on the Gradle Plugin Portal, and the `com.keewano:keewano-codegen-binary`
artifact it resolves the executable from is not on Maven Central or any other
public Maven repository. An Android project installs the tool from npm or pip
like every other project, and runs it as an ordinary build step.

The plugin source lives under `wrappers/gradle/` for anyone who wants to wire it
up from a checkout. Applied, it registers the generated directory as a Kotlin
source directory, so generation joins the build and nothing is committed;
`./gradlew keewanoGenerate` runs it explicitly (it also writes the asset the SDK
reads at launch), and `keewanoAdd`, `keewanoEdit` and `keewanoRemove` run the
commands:

```bash
./gradlew keewanoAdd --args="EnemyKilled --type string"
```

Wiring it up means an included build plus a local Maven repository holding the
executable, because neither half is published.
[`scripts/check-wrappers.sh`](scripts/check-wrappers.sh) does exactly that and is
the working example.

### From Swift Package Manager - not published

**The SPM package is not published.** There
is no `.package(url:)` to add: the manifest lives at `wrappers/spm/Package.swift`
rather than at the repository root, and its `binaryTarget` names a local
`artifacts/keewano-codegen.artifactbundle` rather than a URL and checksum, which
is what a remote SPM package would need. An iOS project installs the tool from
npm or pip and runs it as a build phase.

From a checkout the package resolves by path, once the bundle it points at has
been built (`npm run build:binaries && npm run build:bundle` writes
`wrappers/spm/artifacts/`):

```swift
.package(path: "../keewano-codegen/wrappers/spm")

.target(name: "App", plugins: [.plugin(name: "KeewanoCodegen", package: "keewano-codegen")])
```

There is then no generate command at all - the build-tool plugin runs on every
`swift build` and writes into the build directory, so the generated Swift is not
something anybody commits. The commands stay explicit, because they write into
the package:

```bash
swift package --allow-writing-to-package-directory keewano-codegen add EnemyKilled --type string
```

### Without Node

Therer is an option to build a standalone executable for Linux (x64 and arm64), macOS
(Intel and Apple silicon) and Windows (x64).

**These are not attached to the GitHub releases.** They are kept as job artifacts. Without Node,
the supported way to get one is `pip install keewano-codegen`: the wheel for your
platform carries exactly this executable. From a checkout,
`npm run build:binaries` writes them all into `binaries/`.

However it was obtained, one runs exactly like the npm CLI - it needs no Node and
no `npm install`:

```
./keewano-codegen-macos-arm64 --input keewano.events.json --target swift --code Sources/App
```

This is what an SPM build-tool plugin or a CocoaPods script phase invokes, for
projects that would rather generate during the build than commit the generated
file. Every recorded vector goes through the executable for the platform the
pipeline builds on and is compared byte for byte; the cross-compiled builds for
the other platforms are not executed there, so treat that comparison as covering
the generator, not each individual executable.

## Quick start

1. Create `keewano.events.json` with one entry per event:

   ```json
   {
     "events": [
       { "eventName": "PlayerRank", "eventValueType": "uint" },
       { "eventName": "EnemyKilled", "eventValueType": "string" },
       { "eventName": "GameOver", "eventValueType": "none" }
     ]
   }
   ```

   An event's id is 2500 plus its position: `PlayerRank` is 2500, `EnemyKilled`
   2501, `GameOver` 2502. The id is what identifies the event in a log and on
   the backend, and the file does not write it down - the order is the
   numbering. So add new events at the end and never reorder; an entry that
   moves reports under a number the backend has never seen it on.
   `keewano-codegen add` appends for you; see [Commands](#commands).

   `eventName` is PascalCase (`^[A-Z][A-Za-z0-9_]*$`, up to 128 characters);
   `eventValueType` is the payload type by its wire name:

   | `eventValueType` | Payload                             |
   | ---------------- | ----------------------------------- |
   | `none`           | none                                |
   | `string`         | UTF-8 string                        |
   | `uint`           | unsigned 32-bit integer             |
   | `bool`           | boolean                             |
   | `timestamp`      | Unix timestamp, seconds             |
   | `ushortvec2`     | two unsigned 16-bit integers (x, y) |
   | `price_usd_cent` | price in USD cents, unsigned 32-bit |

   Editors can check the file as you type: point them at the schema the
   package ships, `node_modules/@keewano/codegen/schemas/keewano-events.schema.json`
   (in VS Code, the `json.schemas` setting). The mapping lives in the editor
   because the file itself carries no `$schema` key - an unknown key is
   rejected, so a typo cannot pass as a valid definition.

2. Generate for your SDK, naming the directory the file goes in:

   ```bash
   npx keewano-codegen --target web --code src/analytics
   npx keewano-codegen --target swift --code Sources/App
   npx keewano-codegen --target kotlin --code app/src/main/kotlin/com/keewano/sdk/generated --asset app/src/main/assets
   npx keewano-codegen --target python --code myapp
   ```

   The file's name is the target's, because the SDK that imports it looks for
   that name: `keewano-events.generated.ts` for the four TypeScript targets,
   `KeewanoCustomEvents.Generated.swift`, `KeewanoCustomEvents.Generated.kt`
   and `keewano_custom_events.py`. `--code` is required rather than defaulted:
   the file has to sit in a source set the toolchain compiles, and only you know
   where that is. [Targets](#targets) below has a worked example per target.

   The Kotlin target emits two artifacts. The reporters go under `--code` in
   the contract's fixed package (`com.keewano.sdk.generated` - there is nothing
   to configure), and the definition set goes under `--asset` as
   `keewano_custom_events.json`, where the Android SDK reads it at launch with
   no init code at all. `--asset` is therefore the `src/main/assets` of the
   module that ships it, and it is required for this target - and refused for
   every other, since no other SDK reads one.

3. Hand the generated set to the SDK and call the generated helpers -
   `reportPlayerRank(42)`, `reportEnemyKilled('orc')`, `reportGameOver()`.
   TypeScript exports `customEventSet` for `Keewano.init`; Swift exposes
   `KeewanoCustomEvents.set`; on Android there is nothing to pass, because the
   SDK reads the emitted asset at launch.

   Where the helper lives differs by target. Swift and Kotlin put it on the SDK
   type, so it reads like a built-in `report*` method. The TypeScript targets
   emit free functions you import from the generated module, and the `node`
   target takes the per-batch reporter as the first argument -
   `reportPlayerRank(reporter, 42)` - because the relay emits inside
   `reportUserBatch`.

## Targets

One `--target` per SDK, seven in all. Each writes a file whose name belongs to
the target - the SDK that imports it looks for exactly that name - so a command
names only the directory it goes in. `--input` defaults to
`./keewano.events.json`, and `--target` to `react-native`.

| `--target`               | Generated file                        | Written against                  | Also                            |
| ------------------------ | ------------------------------------- | -------------------------------- | ------------------------------- |
| `react-native` (default) | `keewano-events.generated.ts`         | `@keewano/react-native-sdk`      |                                 |
| `expo`                   | `keewano-events.generated.ts`         | `@keewano/react-native-expo-sdk` |                                 |
| `node`                   | `keewano-events.generated.ts`         | `@keewano/node-sdk`              | helpers take the reporter first |
| `web`                    | `keewano-events.generated.ts`         | `@keewano/web-sdk`               |                                 |
| `swift`                  | `KeewanoCustomEvents.Generated.swift` | `KeewanoSDK`                     |                                 |
| `kotlin`                 | `KeewanoCustomEvents.Generated.kt`    | `com.keewano.sdk`                | `--asset` is required           |
| `python`                 | `keewano_custom_events.py`            | `keewano_sdk`                    |                                 |

Every example below generates the three events from the [quick
start](#quick-start) - `PlayerRank` (uint), `EnemyKilled` (string) and
`GameOver` (none). `npx keewano-codegen` and a plain `keewano-codegen` are the
same tool; which one you type depends only on whether it came from npm, from pip
or from a downloaded executable.

### `react-native`

```bash
npx keewano-codegen --target react-native --code src/analytics
```

Writes `src/analytics/keewano-events.generated.ts`, which exports the helpers as
free functions plus the `customEventSet` the SDK is initialised with:

```ts
import { Keewano } from '@keewano/react-native-sdk';

import { customEventSet, reportEnemyKilled } from './analytics/keewano-events.generated';

Keewano.init({ apiKey, customEventSet });
reportEnemyKilled('orc');
```

### `expo`

```bash
npx keewano-codegen --target expo --code src/analytics
```

The same file and the same shape as `react-native`; only the SDK it imports
differs, `@keewano/react-native-expo-sdk`.

### `web`

```bash
npx keewano-codegen --target web --code src/analytics
```

Again the same shape, against `@keewano/web-sdk`.

### `node`

```bash
npx keewano-codegen --target node --code src/analytics
```

The one TypeScript target whose helpers differ: the relay reports inside
`reportUserBatch`, so each helper takes that batch's reporter as its first
argument.

```ts
import { customEventSet, reportEnemyKilled } from './analytics/keewano-events.generated';

// inside the reportUserBatch callback, which hands you the reporter
reportEnemyKilled(reporter, 'orc');
```

### `swift`

```bash
keewano-codegen --target swift --code Sources/App
```

Writes `Sources/App/KeewanoCustomEvents.Generated.swift`. The helpers are added
to `KeewanoSDK` itself, so they read like built-in `report*` methods, and the
definition set is `KeewanoCustomEvents.set`:

```swift
KeewanoSDK.reportEnemyKilled("orc")
```

### `kotlin`

The only target that writes two files, so it is the only one that takes
`--asset`:

```bash
keewano-codegen --target kotlin \
  --code app/src/main/kotlin/com/keewano/sdk/generated \
  --asset app/src/main/assets
```

- `app/src/main/kotlin/com/keewano/sdk/generated/KeewanoCustomEvents.Generated.kt` -
  extension functions on `KeewanoSDK`, in the contract's fixed package
  `com.keewano.sdk.generated`; `--code` has to be the directory that package
  resolves to.
- `app/src/main/assets/keewano_custom_events.json` - the definition set, which
  the Android SDK reads at launch. There is nothing to pass at init.

```kotlin
KeewanoSDK.reportEnemyKilled("orc")
```

### `python`

```bash
keewano-codegen --target python --code myapp
```

Writes `myapp/keewano_custom_events.py`, exporting snake_case helpers and
`CUSTOM_EVENT_SET`:

```python
from myapp.keewano_custom_events import CUSTOM_EVENT_SET, report_enemy_killed

report_enemy_killed("orc")
```

## Commands

The definitions file is plain JSON and you can edit it by hand, but you do not
have to. Three commands do the bookkeeping - appending at the end, renaming in
place, refusing a name that will not work:

```sh
npx keewano-codegen add EnemyKilled --type string
npx keewano-codegen edit EnemyKilled --rename EnemyDefeated
npx keewano-codegen remove EnemyDefeated
```

`add` appends the entry, so the new event takes the next id, and creates the
file when there is none yet. `--type` takes a wire name from the table above.

`edit` renames the event in place and carries its position - so its id - and
its payload type across: the id is what recorded data was written under, and
the payload type is what that data holds, so an event that needs a different
type is a different event.

`add` and `edit` refuse a name before writing anything if that name is already
taken by predefined (built in) event and `add` also refuse a name if the name
already exists in the keewano.events.json file.

`remove` is for an event that is not used anymore and is not planned to be used
in the future.

## Options

| Flag              | Default                  | Meaning                                                                                                                       |
| ----------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `--input <file>`  | `./keewano.events.json`  | The definitions file                                                                                                          |
| `--code <dir>`    |                          | Directory the generated file is written into; required, and the file's name is the target's                                   |
| `--target <sdk>`  | `react-native`           | `react-native`, `expo`, `node`, `web`, `kotlin`, `swift`, `python`                                                            |
| `--asset <dir>`   |                          | Directory the `kotlin` definition-set asset (`keewano_custom_events.json`) is written into; required there, refused elsewhere |
| `--json`          | off                      | Also write `keewano-events.json` next to the generated file (see below)                                                       |
| `--no-json`       |                          | Do not write it, even if the settings file says so                                                                            |
| `--config <file>` | `./keewano.codegen.json` | Settings file to read; the default may be absent, a named one must exist                                                      |
| `--watch`         | off                      | Regenerate on every save of the definitions file                                                                              |
| `--version`       |                          | Print the version of this package and exit                                                                                    |
| `--help`          |                          | Print usage, the commands and these options, and exit                                                                         |

The exit code tells a CI script what happened:

| Code | Meaning                                                 |
| ---- | ------------------------------------------------------- |
| 0    | Generated, or already up to date                        |
| 1    | The input was rejected (schema, names, flags, settings) |
| 2    | A file or folder could not be read or written           |
| 3    | An internal error - please report it                    |

Settings can live in `keewano.codegen.json` in the folder the command runs from
(the package root for an npm script), so nobody has to remember flags:

```json
{
  "input": "keewano.events.json",
  "code": "src/analytics",
  "target": "web",
  "json": true
}
```

Flags always win over the file; the file wins over the defaults. Relative
paths in the file are resolved against the file's own directory. An unknown
key is an error, so a typo cannot silently fall back to the default target, and
a file named with `--config` must exist for the same reason.

Commit the generated file. Rerun the generator only when the event set
changes; the output is deterministic, so an unchanged set produces an
unchanged file and an empty diff. The exception is a project that runs the
generator during its own build, as described under [Without Node](#without-node)

- there the file is a build artifact and committing it would only go stale.

## Sharing one definitions file across SDKs

Everything above reads as one project generating for one platform. A company
with an Android app and an iOS app has two projects reporting the same events,
and often a backend or a web dashboard reporting some of them too. The generator
is built for that case: the definitions file is an input named by a path, not
something that has to live in the project it generates into.

So the file gets a home of its own - its own repository, or one directory in a
monorepo - and every platform generates from that one copy. Nobody forks it.

### Why one copy, and not a copy each

The set's identity is computed identically by every emitter - see
[The frozen contract](#the-frozen-contract). Two copies that
have drifted by one event, or by one different event name, and the two
apps then report under two schemas where the company has one set. One file makes
disagreement impossible.

It is also the only arrangement in which `add` means what it says. Appending to
two files independently gives the same id to two different events.

### The layout

The generator only ever needs a path, so how the file reaches a platform
repository is that project's choice - a git submodule, a small package the build
depends on, a CI step that checks it out, or simply a sibling directory in a
monorepo. Pin it the way the rest of the build is pinned (a submodule commit, a
package version, a tag): a shared file that moves under an in-flight release
changes what that release reports.

The examples below assume sibling checkouts:

```
keewano-events/          # the shared definitions repository
  keewano.events.json
android-app/
ios-app/
```

### One settings file per platform repository

Each platform repository commits its own `keewano.codegen.json` naming the shared
file and its own target and output. Relative paths in a settings file resolve
against **that file's own directory**, not the working directory, so the same
entry works from the repository root, from a subdirectory, and from CI.

`android-app/keewano.codegen.json`:

```json
{
  "input": "../keewano-events/keewano.events.json",
  "target": "kotlin",
  "code": "app/src/main/kotlin/com/keewano/sdk/generated",
  "asset": "app/src/main/assets"
}
```

`ios-app/keewano.codegen.json`:

```json
{
  "input": "../keewano-events/keewano.events.json",
  "target": "swift",
  "code": "Sources/App"
}
```

Generation in either repository is then the bare command, with nothing to
remember and nothing to get wrong:

```bash
npx keewano-codegen
```

The two repositories need not install the tool the same way. The Android one can
take it from npm and the iOS one from pip, or either can run a
[standalone executable](#without-node); all three are the same generator, and the
recorded vectors are compared byte for byte across them.

### Declaring an event

The commands accept `--input` and `--config` exactly as generation does, and they
read the same settings file. So a developer in either repository declares an
event without going anywhere:

```bash
npx keewano-codegen add EnemyKilled --type string
```

Worth knowing rather than discovering: with the settings above, that writes to
`../keewano-events/keewano.events.json`. The command edits the shared file, not a
local one, which is the point - but it also means the change belongs in a commit
to the shared repository, reviewed like any other change to a contract two apps
depend on. Running the commands inside `keewano-events/` itself, where `--input`
needs no configuring at all, keeps that obvious.

### Keeping the platforms in step

Regenerate every platform in the same change as the definitions edit. Two things
make that more than tidiness:

- **`remove` renumbers.** Taking an event out moves every event after it down one
  id - the command prints which ones. A platform that has not regenerated is then
  reporting several events under ids that now mean something else. An event that
  is finished is usually better left in the file and simply not called.
- **`edit --rename` keeps the id and the type**, which is what makes it the safe
  one: the position does not move, so a platform that regenerates later reports
  the same event under the same id, by a new name.

Adding is the benign case - a new event takes the next free id and nothing that
already exists moves - but a platform that has not regenerated still carries the
previous set's hash until it does.

Because the output is deterministic and the generated files are committed, CI can
catch a repository that fell behind. Regenerate and fail on a diff:

```bash
npx keewano-codegen && git diff --exit-code
```

An unchanged set rewrites nothing and leaves an empty diff, so this only fires
when the shared file moved and the generated file did not.

## Names

An event's name becomes a `report<Name>` helper in the generated source, sitting
next to the SDK's own `report*` methods. A name that would collide with one of
those (`ButtonClick`, `WindowOpen`, `InAppPurchase`, ...) is therefore rejected
here, with a message naming the clash, rather than producing a wrapper that
shadows a built-in.

## The readable manifest (`--json`)

Every binary SDK registers the event set with the backend by uploading a
compressed map. The map is opaque: you cannot read event ids or types out of
it without a decoder. `--json` writes the same payload wrapped with what the
bytes alone do not say:

```json
{
  "schemaVersion": 1,
  "version": 2616383230,
  "eventCount": 3,
  "gzipDataBase64": "H4sIAAAAAAAA/zvCye2al5pb6Z2Zk5OawshwlJPDPTE31b8stYiB4RgnV0BOYmVqUVBiXjYTAwD6sNWfLAAAAA==",
  "events": [
    { "id": 2500, "name": "EnemyKilled", "type": 1, "dataType": "string" },
    { "id": 2501, "name": "GameOver", "type": 0, "dataType": "none" },
    { "id": 2502, "name": "PlayerRank", "type": 2, "dataType": "uint" }
  ]
}
```

It is for two situations: an SDK that has no generator template yet can
consume this file directly instead of decoding the map, and a schema can be
checked against the backend without tooling. `dataType` uses the server's own
spelling. Nothing at runtime depends on this file.

## The frozen contract

The event set's identity is a hash over bytes. Every SDK on every platform must
arrive at the same hash for the same events, or the backend sees two schemas
where there is one - so the pipeline below is implemented once, here, and never
reimplemented per language. Do not change any step without a backend-side
migration.

1. **Parse.** One file, validated against `schemas/keewano-events.schema.json`.
2. **Number the events.** The first entry is 2500, the next 2501, and so on;
   the file carries no id and the generator refuses one written into it. The
   last usable id is 65535, so a file holds at most 63036 events.
3. **Keep the declaration order.** It is the numbering, so the same file
   always yields the same bytes.
4. **Write the map**, one record per event, no header, no count prefix:

   ```
   [uint16 LE id][varint UTF-8 byte length][UTF-8 name][uint16 LE type]
   ```

   The varint is unsigned LEB128: seven bits per byte, low group first, high bit
   set on every byte but the last.

5. **Gzip** the map with pako at level 9 (the dependency is pinned).
6. **Normalize the gzip header**: bytes 4-7 (MTIME) and 8 (XFL) become `0`, byte
   9 (OS) becomes `0xFF`. Without this the same events would hash differently on
   a Windows laptop and a Linux CI box.
7. **Hash** the normalized bytes with FNV-1a 32-bit (offset basis `0x811C9DC5`,
   prime `0x01000193`). The result is the set's `version`, sent as
   `K-CustomEventHash` on the binary route and `customEventsHash` on the JSON
   route, and stamped on every batch.

**A file declaring no events is accepted, and it stamps `0`.** Zero entries
parse to zero events, which a project has whenever it wires the generator into
its build before declaring its first event. The seven steps above are skipped
for that case and the version is `0`, the value the wire protocol reserves for
"no custom-event schema": every SDK reads it and short-circuits the whole
custom-event path. Hashing the gzip of an empty map would give a confident
non-zero stamp instead, and an SDK receiving it would persist a blob describing
nothing, tag every batch with it, and hold each upload until the backend
registered it - so a project that had not declared an event yet would stop
reporting anything at all. A missing definitions file is a different case and
fails with an I/O error.

The result every emitter receives is `{ version, eventCount, gzipData }` plus the
event list. Binary SDKs upload `gzipData` and stamp `version`; JSON SDKs build
their registration body from the event list and carry each event's `dataType`
on the wire. Same run, same hash, both protocols.

`conformance/` holds recorded vectors - definitions files with the exact
expected output for every target and the expected version. The version stamps
are the cross-check against the SDKs: they were captured before this repository
existed, from the generator that ran inside the SDK and used its own encoder and
hash, so a stamp that still reproduces is proof this reimplementation agrees
with the original. The expected files are this package's own output, recorded
so a rendering change has to be deliberate.

They are frozen where it counts. `versions.json` is each set's identity for the
input it was recorded from: while that input stays as it is, the stamp is never
re-recorded, and a failing version means the code changed the contract, so the
code is what gets fixed. Editing a corpus is the other case - a different set of
events is a different identity by definition - and then the stamp is re-recorded
deliberately and cross-checked against a generator that already implements the
contract. The expected `.generated.ts` files are rendering snapshots: a
deliberate template change re-records them in the same commit, and the untouched
version stamps are the proof that only the rendering moved.

## Programmatic use

```ts
import { emitGeneratedSource, parseEventDefinitions } from '@keewano/codegen';

const { events } = parseEventDefinitions({ inputFile: '/abs/keewano.events.json' });
const source = emitGeneratedSource({ events, target: 'web' });
```

`buildCustomEventSet(events)` is exported too, for a script that wants the
version and the compressed map on their own, and `run(argv)` is the CLI itself
and resolves to an exit code.

`parseEventDefinitions` returns the events in declaration order, each with the
id its position gives it, and that is what `buildCustomEventSet` is written for:
the order decides the bytes, so a reordered list would hash to a version the
backend reads as a different schema. Before hashing anything it checks that it
was handed an array of objects, that every name matches the schema and appears
once, that every type is one of the seven tags, and that the ids are inside the
range and ascend - and refuses the list otherwise.

`parseEventDefinitions` throws `ParseError` for rejected input and `IoError` for
a file it cannot read. `emitGeneratedSource` throws `EmitError` for a list it
would not render - one it was handed rather than parsed - and `ParseError` for
two names that reach one identifier on the target being emitted, which is the
caller's own naming to fix. `buildCustomEventSet` throws `ParseError` for
everything it refuses, including a value that is not a list of events at all.
All three classes are exported, along with `CustomEventType`,
`FIRST_CUSTOM_EVENT_ID`, and the argument and result types.

## Building the codegen itself

For working on the generator, not for using it - nothing here is needed to
install the tool or to generate a file. Every command is an npm script, so the
same line runs locally and in the pipeline.

Start from a checkout with the Node in [`.nvmrc`](.nvmrc) and a clean install:

```bash
npm ci
```

That is the whole toolchain for the npm package and the executables - the
compiler that produces them ships as a dev dependency. The other three artifacts
need a toolchain this repository cannot install for you, and each takes it from
the PATH or from a container, whichever is there:

| Artifact            | Command                  | Output                    | Also needs           |
| ------------------- | ------------------------ | ------------------------- | -------------------- |
| npm package         | `npm run build:prod`     | `dist/`, then `npm pack`  | nothing              |
| Standalone binaries | `npm run build:binaries` | `binaries/`               | network on first run |
| Python wheels       | `npm run build:wheels`   | `wheels/`                 | Python 3, or Docker  |
| SPM artifact bundle | `npm run build:bundle`   | `wrappers/spm/artifacts/` | nothing              |
| Gradle plugin       | `npm run check:plugin`   | `wrappers/gradle/build/`  | Gradle, or Docker    |

The npm package, the wheels and the artifact bundle all read their version from
`package.json`, the one place it is written down, so a release is that field plus
a build. The executables carry none: the compiler bakes in a path to a
`package.json` the downloader does not have, so a standalone build answers
`unknown` to `--version`.

### Node - the npm package

```bash
npm run clean
npm run build:prod
npm pack
```

`build:prod` is the release build ([`tsconfig.prod.json`](tsconfig.prod.json)):
source maps with inlined sources for debugging, no declaration maps. `npm run
build` is the development build and keeps both. Either writes `dist/`.

Clean first. `files` ships `dist/` wholesale, so a compiled file whose source has
since been deleted stays there and packs, and nothing about `npm pack` notices.

`npm pack` writes `keewano-codegen-<version>.tgz`. To install that tarball into
another project on this machine rather than reading the working tree:

```bash
npm run pack:local -- ../some-project
```

### Standalone binaries

```bash
npm run build
npm run build:binaries
```

Compiles [`bin/keewano-codegen.cjs`](bin/keewano-codegen.cjs) - the same entry
npm installs - into a dependency-free executable per platform, written to
`binaries/`:

| File                              | Platform             |
| --------------------------------- | -------------------- |
| `keewano-codegen-linux-x64`       | Linux, x64           |
| `keewano-codegen-linux-arm64`     | Linux, arm64         |
| `keewano-codegen-macos-arm64`     | macOS, Apple silicon |
| `keewano-codegen-macos-x64`       | macOS, Intel         |
| `keewano-codegen-windows-x64.exe` | Windows, x64         |

`dist/` has to exist first, which is what the `npm run build` above is for. All
five are produced from whichever machine runs the script, so one build covers
every platform - but the compiler fetches the runtimes for the other four from
the registry the first time, around 200 MB. A name fragment builds only the
targets that match, which is what a local run usually wants:

```bash
npm run build:binaries -- linux-x64
```

Build them on glibc, not musl: a musl host packs its own runtime into the
`linux-x64` executable, which then asks for a loader an ordinary distro does not
have and dies as "file not found" on a file that exists. The pipeline uses a
`bookworm` image for this reason.

### Python - the wheels

```bash
npm run build:binaries
npm run build:wheels
```

One wheel per platform in `wheels/`, each carrying that platform's executable and
nothing else. There is no source distribution on purpose: an sdist would promise
a build from source, and the generator is not Python.

| Executable packed                 | Wheel platform tag      |
| --------------------------------- | ----------------------- |
| `keewano-codegen-linux-x64`       | `manylinux2014_x86_64`  |
| `keewano-codegen-linux-arm64`     | `manylinux2014_aarch64` |
| `keewano-codegen-macos-arm64`     | `macosx_11_0_arm64`     |
| `keewano-codegen-macos-x64`       | `macosx_10_9_x86_64`    |
| `keewano-codegen-windows-x64.exe` | `win_amd64`             |

The script uses the `python` on the PATH if there is one and reaches for
`python:3.12-slim` in Docker if there is not, so the same line works on a laptop
without Python and inside a Python image. It also needs `node`, to read the
version out of `package.json`.

A wheel that packs cleanly can still carry a stale or wrong-platform binary and
install without complaint, so prove the one for this machine runs. Resolve it by
name rather than by glob - both manylinux wheels match one, and pip refuses the
whole command over the one that is not for this runner:

```bash
pip install --no-index --find-links wheels keewano-codegen
npm run check:wheel      # the installed command against the recorded vectors
npm run check:launcher   # the wrapper's own tests, including the recovery path
```

### SPM - the artifact bundle

```bash
npm run build:binaries
npm run build:bundle
```

Assembles `wrappers/spm/artifacts/keewano-codegen.artifactbundle`, which is what
the `binaryTarget` in [`wrappers/spm/Package.swift`](wrappers/spm/Package.swift)
resolves. Four variants, because SPM does not run on Windows:

| Executable packed             | SPM triple                  |
| ----------------------------- | --------------------------- |
| `keewano-codegen-macos-arm64` | `arm64-apple-macosx`        |
| `keewano-codegen-macos-x64`   | `x86_64-apple-macosx`       |
| `keewano-codegen-linux-x64`   | `x86_64-unknown-linux-gnu`  |
| `keewano-codegen-linux-arm64` | `aarch64-unknown-linux-gnu` |

No Swift toolchain is involved: a bundle is the executables plus a JSON manifest,
so this assembles on any machine. The bundle lands inside the package rather than
beside the repository because SPM refuses a binary target path that leaves the
package root. It is not published - see
[From Swift Package Manager](#from-swift-package-manager---not-published).

### Gradle - the plugin

```bash
npm run check:plugin
```

Builds the plugin under `wrappers/gradle/` and runs its unit tests, using the
`gradle` on the PATH or `gradle:8.10-jdk17` in Docker. A run that selects no
tests fails rather than reporting success.

To drive it the way a consumer would - applied to a project, generating against a
recorded vector - use the end-to-end check, which needs Docker:

```bash
npm run check:wrappers   # the Gradle and SPM wrappers, both
```

The plugin takes its version from `-PkeewanoVersion`, defaulting to the value in
[`wrappers/gradle/build.gradle.kts`](wrappers/gradle/build.gradle.kts). There is
no publish task wired, because it is not published - see
[From Gradle](#from-gradle---not-published).

### Everything the pipeline builds

```bash
npm run build:ci
```

`build:prod`, then `build:binaries`, then the four checks that guard what they
produced:

- `check:determinism` generates every recorded vector twice and diffs the runs
  against each other and against the recording.
- `check:classifiers` compares the Maven classifiers the Gradle plugin resolves
  against the targets `build-binaries.cjs` declares - nothing else connects the
  two, and a name that drifts is a 404 in a consumer's build.
- `check:tables` requires every declared platform to have its wheel row and its
  host row, and Windows to be absent from the artifact bundle.
- `check:glibc` compares the glibc each Linux executable actually needs against
  what its `manylinux` tag promises.

The determinism check drives the executable for this host as well as the CLI, so
it fails if `binaries/` is missing; `KEEWANO_ALLOW_SKIP=1` accepts an unverified
run when that is what you meant.

[CONTRIBUTING.md](CONTRIBUTING.md) covers the test suite, the layering rules and
the four checks that compare this package against the SDK repositories.

## License

MIT
