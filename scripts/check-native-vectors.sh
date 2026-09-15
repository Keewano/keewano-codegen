#!/usr/bin/env bash
#
# Compile the recorded Swift and Kotlin vectors against the SDK surfaces in
# conformance/__sdk-surfaces/. The TypeScript vectors already have this: `npm run
# typecheck` compiles them through conformance/tsconfig.json. The native ones
# cannot join the pipeline as cheaply - the toolchains are large images - so
# this runs on demand, and on any machine with Docker.
#
# Run it whenever an emitter changes. A vector that no longer compiles is a
# generated file that would not compile in a customer's project either.
#
# Usage: scripts/check-native-vectors.sh
set -euo pipefail

# Git Bash rewrites the container-side paths below into Windows paths, and every
# vector then reports a file that is not there. The check runs on the machines
# this package is developed on, so it turns the rewrite off itself.
export MSYS_NO_PATHCONV=1

# The images are pinned. A check whose whole claim is that one input gives one
# output cannot rest on a tag somebody else can move under it, and the inspect
# short-circuit below would then keep whatever was pulled first, forever. Both
# tags were checked to resolve with `docker manifest inspect`.
#
# zenika/kotlin publishes nothing newer than 1.4.20 (2020). That is old, and it
# is deliberately a floor rather than the compiler a customer runs: the emitted
# Kotlin uses nothing past 1.0 - an extension function, a range check, shl/or -
# so compiling on 1.4 says it compiles anywhere later. It cannot report a
# deprecation, which is what an official kotlinc image would add if one existed.
KOTLIN_IMAGE="zenika/kotlin:1.4.20"
SWIFT_IMAGE="swift:6.0.3"
# 3.8 deliberately, not the newest: the generated file uses nothing past
# typing annotations, so importing on the oldest interpreter anyone still
# deploys says it runs anywhere later.
PYTHON_IMAGE="python:3.8-slim"

root="$(cd "$(dirname "$0")/.." && pwd)"
status=0

# The container plumbing: running a compiler, reporting a missing toolchain, and
# refusing a corpus with no vectors. Sourced so this file stays about the two
# languages rather than about docker.
. "$(dirname "$0")/lib/compile.sh"

if have_image "${KOTLIN_IMAGE}"; then
  for vector in "${root}"/conformance/*/expected/kotlin.generated.kt; do
    require_vectors "${vector}" kotlin || break
    set_name="$(basename "$(dirname "$(dirname "${vector}")")")"
    # The SDK is built first and the vector against the result, the way the
    # Swift branch below emits a module and then compiles against it. Handing
    # both files to one invocation makes them one Kotlin module, and `internal`
    # is visible inside a module - so an overload the SDK stopped publishing
    # would compile here and fail in the app that installs it.
    run_compiler "kotlin ${set_name}" \
      docker run --rm -v "${root}:/w:ro" "${KOTLIN_IMAGE}" sh -c "
        kotlinc /w/conformance/__sdk-surfaces/KeewanoSDK.kt -d /tmp/keewano-sdk.jar &&
        kotlinc -classpath /tmp/keewano-sdk.jar '/w/${vector#"${root}/"}' -d /tmp/out"
  done
else
  report_missing_toolchain kotlin
fi

# The generated file lands in the customer's target, whose language mode this
# package does not control, so both modes are checked. Mode 6 currently fails:
# the SDK's set type is not Sendable, which makes the generated `static let` a
# concurrency error. That state is pinned rather than hidden - the day the SDK
# adds Sendable, this says so instead of staying quiet.
SWIFT6_EXPECTED_TO_FAIL=1

# Mode 6 is expected to fail, so its output is what decides *why*. Throwing the
# output away and branching on the exit status alone reported "fails as
# expected, the set type is not Sendable" for a daemon hiccup or an empty mount
# just as readily - a verdict asserting a reason nothing had read.
swift6_output=""
check_swift_mode() {
  local vector="$1"
  swift6_output="$(docker run --rm -v "${root}:/w:ro" "${SWIFT_IMAGE}" sh -c "
      cd /tmp &&
      swiftc -emit-module -module-name KeewanoSDK -o KeewanoSDK.swiftmodule /w/conformance/__sdk-surfaces/KeewanoSDK.swift &&
      swiftc -typecheck -swift-version 6 -I . '/w/${vector}'" 2>&1)"
}

report_swift6() {
  local set_name="$1" compiled="$2"
  if [ "${compiled}" = "0" ]; then
    if [ "${SWIFT6_EXPECTED_TO_FAIL}" = "1" ]; then
      # Why it now compiles is not something this read: the pin says it must
      # not, and it did. Check whether the SDK gained Sendable, then drop the pin.
      echo "swift ${set_name} (language mode 6): compiles, and the pin says it must not - check whether the SDK gained Sendable, then drop SWIFT6_EXPECTED_TO_FAIL" >&2
      status=1
    else
      echo "swift ${set_name} (language mode 6): compiles"
    fi
    return
  fi
  if [ "${SWIFT6_EXPECTED_TO_FAIL}" != "1" ]; then
    echo "swift ${set_name} (language mode 6): does not compile" >&2
    echo "${swift6_output}" >&2
    status=1
    return
  fi
  # Only the pinned diagnostic is the expected state, and every error line
  # must be it: a second error of any kind - even one that also mentions
  # Sendable - is a regression the pin must not absorb. The text is the
  # compiler's own, captured from a real mode-6 run.
  pinned="static property 'set' is not concurrency-safe because non-'Sendable' type 'KeewanoCustomEventSet'"
  unexpected="$(printf '%s\n' "${swift6_output}" | grep 'error:' | grep -vF "${pinned}" || true)"
  if [ -z "${unexpected}" ] && printf '%s\n' "${swift6_output}" | grep -qF "${pinned}"; then
    echo "swift ${set_name} (language mode 6): fails as expected, the SDK set type is not Sendable"
  else
    echo "swift ${set_name} (language mode 6): failed for another reason, so nothing was confirmed" >&2
    echo "${swift6_output}" >&2
    status=1
  fi
}

# The vector is imported and then run, not just parsed. Importing alone gets
# the module-level from_gzip_base64 call, which really decodes the embedded
# base64, so broken base64 fails here where py_compile would have stayed
# green. It gets nothing else: Python resolves an attribute when the line
# executes, so every `KeewanoCodegen.report_*` inside a wrapper body is still
# unlooked-at after a clean import, and a wrapper calling a bridge that does
# not exist imported perfectly. Hence the second half - every generated
# wrapper is called once, with a dummy argument per annotation, which is what
# makes the bridge names resolve. An annotation with no dummy stops the check
# rather than skipping the wrapper, so a new payload type is noticed here
# instead of quietly losing its coverage.
if have_image "${PYTHON_IMAGE}"; then
  for vector in "${root}"/conformance/*/expected/python.generated.py; do
    require_vectors "${vector}" python || break
    set_name="$(basename "$(dirname "$(dirname "${vector}")")")"
    run_compiler "python ${set_name}" \
      docker run --rm -v "${root}:/w:ro" "${PYTHON_IMAGE}" \
      python -I -c "
import importlib.util, inspect, sys
sys.path.insert(0, '/w/conformance/__sdk-surfaces')
spec = importlib.util.spec_from_file_location('generated', '/w/${vector#"${root}/"}')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
dummy = {int: 0, str: '', bool: False}
for name, wrapper in vars(module).items():
    if not name.startswith('report_') or not callable(wrapper):
        continue
    parameters = list(inspect.signature(wrapper).parameters.values())
    for parameter in parameters:
        if parameter.annotation not in dummy:
            raise SystemExit('no dummy value for ' + name + ': ' + repr(parameter.annotation))
    wrapper(*[dummy[parameter.annotation] for parameter in parameters])
"
  done
else
  report_missing_toolchain python
fi

if have_image "${SWIFT_IMAGE}"; then
  for vector in "${root}"/conformance/*/expected/swift.generated.swift; do
    require_vectors "${vector}" swift || break
    set_name="$(basename "$(dirname "$(dirname "${vector}")")")"
    relative="${vector#"${root}/"}"
    run_compiler "swift ${set_name} (language mode 5)" \
      docker run --rm -v "${root}:/w:ro" "${SWIFT_IMAGE}" sh -c "
        cd /tmp &&
        swiftc -emit-module -module-name KeewanoSDK -o KeewanoSDK.swiftmodule /w/conformance/__sdk-surfaces/KeewanoSDK.swift &&
        swiftc -typecheck -swift-version 5 -I . '/w/${relative}'"
    if check_swift_mode "${relative}"; then compiled=0; else compiled=1; fi
    report_swift6 "${set_name}" "${compiled}"
  done
else
  report_missing_toolchain swift
fi

exit "${status}"
