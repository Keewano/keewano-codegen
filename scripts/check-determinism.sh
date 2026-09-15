#!/usr/bin/env bash
#
# The generator's whole value is that the same event set produces the same bytes
# on every machine. The conformance suite proves that against recorded vectors;
# this proves it against itself: generate every vector twice and diff the runs,
# so a nondeterministic dependency - a gzip build that stops honouring the
# pinned level, a header byte that stops being normalized - fails here even if
# it happened to match the recorded bytes once.
#
# It lives in a script rather than in the pipeline so the same command
# reproduces it locally. `npm run build` must have run first: the CLI it drives
# is the built one, not the sources.
#
# The targets come from the recorded vectors themselves, so a new emitter is
# covered the moment its expected files land.
#
# Usage: npm run check:determinism
set -euo pipefail

# npm runs scripts from the package root, so paths stay relative: an absolute
# one built from `pwd` is a POSIX path under Git Bash and node resolves it
# against the drive, which is a class of failure this avoids entirely.
[ -f bin/keewano-codegen.cjs ] || {
  echo "run this through npm from the package root" >&2
  exit 1
}
# The shim is committed, so its presence says nothing about the build behind it.
# What this drives is dist/, and a dist/ older than the sources it came from would
# compare a stale generator against itself and call the result byte-clean - the
# exact failure this check exists to catch, in the local workflow it advertises.
if [ ! -f dist/src/cli/run.js ]; then
  echo "dist/ is missing: run npm run build first, this drives the built CLI" >&2
  exit 1
fi
# What the build actually consumes: the sources it compiles, minus the tests both
# build tsconfigs exclude, plus the schema it bundles. Globbing every *.ts under
# src demanded a rebuild for a test file that never reaches dist/; missing the
# schema let an edit to it run against a stale generator.
newest_source="$(find src -name "*.ts" -not -path "*/__tests__/*" \
  -newer dist/src/cli/run.js -print -quit 2>/dev/null || true)"
if [ -z "${newest_source}" ]; then
  newest_source="$(find schemas -name "*.json" -newer dist/src/cli/run.js -print -quit 2>/dev/null || true)"
fi
if [ -n "${newest_source}" ]; then
  echo "dist/ is older than ${newest_source}: run npm run build first" >&2
  exit 1
fi
# The scratch directory stays inside the package for the same reason the other
# paths do: a system temp path is POSIX here and a drive-relative one to node.
work=".determinism-$$"
rm -rf "${work}"
mkdir -p "${work}"
trap 'rm -rf "${work}"' EXIT
status=0
checked=0
# How one vector is generated and compared, and how a generated file is read
# back out of the directory the run was handed.
. scripts/lib/generatedFile.sh
. scripts/lib/vectorRuns.sh
# The shipped executable is a second implementation path, so it gets the same
# vectors: what it resolves and how it compares live beside it.
. scripts/lib/hostBinary.sh

for set in conformance/*/; do
  # A corpus is a folder with the definitions file under input/; the SDK
  # surfaces the vectors compile against sit beside them and have none.
  [ -d "${set}input" ] || continue
  name="$(basename "${set}")"
  definitions="${set}input/keewano.events.json"
  # An unmatched glob stays literal, and the loop would then hand the CLI a
  # target named "*": the run dies on a usage error that names the flag rather
  # than the corpus, and `set -e` takes every later corpus down with it. A
  # corpus with no recorded vector is also not one this check can speak for, so
  # it is named and counted as a failure rather than passed over.
  vectors=("${set}"expected/*.generated.*)
  if [ ! -e "${vectors[0]-}" ]; then
    echo "no recorded vectors under ${set}expected, so ${name} was not verified" >&2
    status=1
    continue
  fi

  for expected in "${vectors[@]}"; do
    vector="$(basename "${expected}")"
    # The asset is compared beside its module, not driven through the target
    # loop, where its name would read as an extension.
    case "${vector}" in *.generated.asset.json) continue ;; esac
    target="${vector%%.generated.*}"
    # A target whose SDK reads the set from a file writes a second artifact.
    # Which targets those are is read off the recorded vectors, like the targets
    # themselves: naming one here would stop covering the next one silently.
    asset_vector="${set}expected/${target}.generated.asset.json"
    compare_vector_runs "${name}/${target}" "${definitions}" "${target}" "${expected}" \
      "${asset_vector}" "${work}/${name}-${target}" || status=1
    checked=$((checked + 1))
    if [ -f "${asset_vector}" ]; then
      checked=$((checked + 1))
    fi
    if [ -n "${host_binary}" ]; then
      compare_through_binary "${name}/${target}" "${definitions}" "${target}" \
        "${work}/c-${name}-${target}" "${expected}" "${asset_vector}" || status=1
    fi
  done
done

# A run that compared nothing must not read as a pass: an empty corpus folder or
# a renamed vector would otherwise report success having verified nothing.
if [ "${checked}" -eq 0 ]; then
  echo "no recorded vectors were found, so nothing was verified" >&2
  exit 1
fi

echo "determinism: ${checked} vectors generated twice and compared"
# An executable that never ran verified nothing, which must not read as a pass:
# the same rule the vector count above answers to, and the one every other check
# in this folder honours. CI builds the executables two steps earlier, so it
# leaves the flag unset and an unmapped host fails loudly instead of going quiet.
if [ -n "${host_binary}" ]; then
  echo "determinism: all ${checked} also generated through ${host_binary}"
elif [ "${KEEWANO_ALLOW_SKIP:-0}" = "1" ]; then
  echo "determinism: no executable for this host, skipped on request" >&2
else
  echo "determinism: no executable for this host, so it was not verified (KEEWANO_ALLOW_SKIP=1 accepts that)" >&2
  status=1
fi
exit "${status}"
