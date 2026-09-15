#!/usr/bin/env bash
#
# Each wrapper generates what the npm CLI generates.
#
# Building a wrapper proves it packs. It does not prove the executable inside it
# runs, nor that it is the same generator: a wrapper carrying a stale binary, or
# one built for another platform, resolves cleanly and only fails when somebody
# uses it. So each is driven end to end against a recorded vector and the bytes
# are compared - the same comparison the determinism check makes of the CLI, on
# the other side of the delivery.
#
# Docker only, because none of these toolchains is present here and each is a
# gigabyte. Which is also why this runs on demand rather than in `build:ci`, like
# check:native.
#
# Which executable each container drives is decided inside it, by
# lib/containerBinary.sh, and so is whether it was built - asked out here it
# would turn "no toolchain on this machine" into a hard failure about a build
# step, on a run that was going to verify nothing either way.
#
# Usage: npm run check:wrappers   (after npm run build:binaries)
set -euo pipefail

# Git Bash rewrites the container-side paths below into Windows paths, so the
# mounted wrapper is looked for where it is not and the run fails inside the
# container. Turned off here rather than per invocation because every container
# path in this file has the problem.
export MSYS_NO_PATHCONV=1

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GRADLE_IMAGE="gradle:8.10-jdk17"
SWIFT_IMAGE="swift:6.0.3"

# shellcheck source=scripts/lib/compile.sh
. "${root}/scripts/lib/compile.sh"

status=0

check_gradle() {
  have_image "${GRADLE_IMAGE}" || { report_missing_toolchain gradle; return 0; }
  echo "check-wrappers: gradle"
  docker run --rm -v "${root}:/repo:ro" -v keewano-gradle-cache:/home/gradle/.gradle \
    "${GRADLE_IMAGE}" bash -c '
      set -e
      . /repo/scripts/lib/containerBinary.sh
      cp -r /repo/wrappers/gradle /plugin
      mkdir -p /c && cd /c
      cp /repo/conformance/single-event/input/keewano.events.json keewano.events.json
      m=/m/com/keewano/keewano-codegen-binary/0.0.0
      mkdir -p "$m"
      cp "${container_binary}" "$m/keewano-codegen-binary-0.0.0-linux-${container_arch}.bin"
      printf "%s" "<project xmlns=\"http://maven.apache.org/POM/4.0.0\"><modelVersion>4.0.0</modelVersion><groupId>com.keewano</groupId><artifactId>keewano-codegen-binary</artifactId><version>0.0.0</version><packaging>pom</packaging></project>" > "$m/keewano-codegen-binary-0.0.0.pom"
      printf "pluginManagement { includeBuild(\"/plugin\") }\nrootProject.name = \"c\"\n" > settings.gradle.kts
      printf "plugins { id(\"com.keewano.codegen\") }\nrepositories { maven { url = uri(\"/m\") } }\nkeewanoCodegen { code.set(layout.buildDirectory.dir(\"out\")) }\n" > build.gradle.kts
      gradle --no-daemon --quiet keewanoGenerate > /dev/null
      cmp -s build/out/KeewanoCustomEvents.Generated.kt /repo/conformance/single-event/expected/kotlin.generated.kt
      cmp -s src/main/assets/keewano_custom_events.json /repo/conformance/single-event/expected/kotlin.generated.asset.json
    ' || { echo "check-wrappers: gradle output differs from the recorded vector" >&2; return 1; }
  echo "check-wrappers: gradle matches the recorded vector"

  # Generation joins the build, not the developer's memory: a consumer that
  # applies a Kotlin plugin and runs a plain `gradle build` - never naming
  # keewanoGenerate - must end up with the generated file compiled. The SDK
  # surface the generated code extends is compiled in as a second source dir.
  docker run --rm -v "${root}:/repo:ro" -v keewano-gradle-cache:/home/gradle/.gradle \
    "${GRADLE_IMAGE}" bash -c '
      set -e
      . /repo/scripts/lib/containerBinary.sh
      cp -r /repo/wrappers/gradle /plugin
      mkdir -p /c/src/main/kotlin && cd /c
      cp /repo/conformance/single-event/input/keewano.events.json keewano.events.json
      cp /repo/conformance/__sdk-surfaces/KeewanoSDK.kt src/main/kotlin/
      m=/m/com/keewano/keewano-codegen-binary/0.0.0
      mkdir -p "$m"
      cp "${container_binary}" "$m/keewano-codegen-binary-0.0.0-linux-${container_arch}.bin"
      printf "%s" "<project xmlns=\"http://maven.apache.org/POM/4.0.0\"><modelVersion>4.0.0</modelVersion><groupId>com.keewano</groupId><artifactId>keewano-codegen-binary</artifactId><version>0.0.0</version><packaging>pom</packaging></project>" > "$m/keewano-codegen-binary-0.0.0.pom"
      printf "pluginManagement { includeBuild(\"/plugin\") }\nrootProject.name = \"c\"\n" > settings.gradle.kts
      printf "plugins { kotlin(\"jvm\") version \"1.9.24\"\nid(\"com.keewano.codegen\") }\nrepositories { mavenCentral()\nmaven { url = uri(\"/m\") } }\n" > build.gradle.kts
      gradle --no-daemon --quiet build > /dev/null
      compiled=$(find build/classes -name "KeewanoCustomEvents_GeneratedKt.class" | head -1)
      test -n "$compiled"
    ' || { echo "check-wrappers: a plain gradle build did not compile the generated module" >&2; return 1; }
  echo "check-wrappers: a plain gradle build generates and compiles without naming the task"
}

check_spm() {
  have_image "${SWIFT_IMAGE}" || { report_missing_toolchain swift; return 0; }
  echo "check-wrappers: spm"
  # The bundle is build output and gitignored, so a clean checkout has none -
  # and a stale one would make this check pass on yesterday's generator. It is
  # rebuilt from the current binaries every run; the seconds it costs are the
  # price of comparing what would actually ship.
  #
  # The rebuild's own status is read, because `set -e` is not in force here: a
  # function called as `check_spm || status=1` has it disabled throughout. A
  # failed rebuild would otherwise fall through to a comparison against whatever
  # bundle was already on disk, which is the staleness the rebuild prevents.
  bash "${root}/scripts/build-artifactbundle.sh" > /dev/null \
    || { echo "check-wrappers: the artifact bundle could not be rebuilt" >&2; return 1; }
  docker run --rm -v "${root}:/repo:ro" "${SWIFT_IMAGE}" bash -c '
      set -e
      cp -r /repo/wrappers/spm /keewano-codegen
      mkdir -p /c/Sources/App /c/Sources/KeewanoSDK && cd /c
      cp /repo/conformance/single-event/input/keewano.events.json keewano.events.json
      cp /repo/conformance/__sdk-surfaces/KeewanoSDK.swift Sources/KeewanoSDK/
      printf "public let placeholder = 1\n" > Sources/App/App.swift
      printf "// swift-tools-version:5.9\nimport PackageDescription\nlet package = Package(name: \"c\", dependencies: [.package(path: \"/keewano-codegen\")], targets: [.target(name: \"KeewanoSDK\"), .target(name: \"App\", dependencies: [\"KeewanoSDK\"], plugins: [.plugin(name: \"KeewanoCodegen\", package: \"keewano-codegen\")])])\n" > Package.swift
      swift build > /dev/null 2>&1
      generated=$(find .build/plugins -name "KeewanoCustomEvents.Generated.swift" | head -1)
      cmp -s "$generated" /repo/conformance/single-event/expected/swift.generated.swift
    ' || { echo "check-wrappers: spm output differs from the recorded vector" >&2; return 1; }
  echo "check-wrappers: spm matches the recorded vector"
}

check_gradle || status=1
check_spm || status=1

exit "${status}"
