#!/usr/bin/env bash
#
# The installed wheel generates what the npm CLI generates.
#
# Building a wheel proves it packs. It does not prove the executable inside it
# runs, nor that it is the same generator: a wheel carrying a stale binary, or one
# built for another platform, installs cleanly and only fails when somebody uses
# it. So this drives the installed command against the recorded vectors and
# compares bytes - the same comparison the determinism check makes of the CLI, on
# the other side of the delivery.
#
# Expects `keewano-codegen` already on the path, which is what installing the
# wheel does. Run it from a checkout, because the vectors live there.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
. "${root}/scripts/lib/generatedFile.sh"

if ! command -v keewano-codegen > /dev/null 2>&1; then
  echo "check-wheel: keewano-codegen is not on the path, so the wheel was not installed" >&2
  exit 1
fi

compared=0
failed=0
for set in "${root}"/conformance/*/; do
  [ -d "${set}input" ] || continue
  expected="${set}expected/python.generated.py"
  [ -f "${expected}" ] || continue
  name="$(basename "${set}")"
  # The generator names the file; the run is handed a directory and the file is
  # read back out of it, refusing any count but one.
  keewano-codegen --input "${set}input/keewano.events.json" --target python --code "${work}/${name}" > /dev/null
  generated="$(generated_file "${work}/${name}")"
  if cmp -s "${generated}" "${expected}"; then
    echo "check-wheel: ${name} matches"
  else
    echo "check-wheel: ${name} differs from the recorded vector" >&2
    failed=$((failed + 1))
  fi
  compared=$((compared + 1))
done

# A run that compared nothing is never a pass, for the same reason it is not one
# in the surface checks: an empty comparison agrees with everything.
if [ "${compared}" -eq 0 ]; then
  echo "check-wheel: no python vectors were found, so nothing was compared" >&2
  exit 1
fi

# The commands write the definitions, and they are half of what the wheel exists
# to deliver - a wheel that generates but cannot add an event is half installed.
# The first `add` is what creates the file, so its presence is checked too.
cd "${work}"
keewano-codegen add Tap --type none > /dev/null
if [ ! -f keewano.events.json ]; then
  echo "check-wheel: add did not create keewano.events.json" >&2
  exit 1
fi
keewano-codegen edit Tap --rename Touch > /dev/null
keewano-codegen remove Touch > /dev/null
echo "check-wheel: add, edit and remove ran through the installed command"

echo "check-wheel: ${compared} vectors compared, ${failed} differing"
[ "${failed}" -eq 0 ]
