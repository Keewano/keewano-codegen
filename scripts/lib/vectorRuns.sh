#!/usr/bin/env bash
#
# One recorded vector, generated twice through the built CLI and compared: run
# against run, so a nondeterministic dependency shows even when it matched the
# recording once, and run against the recording, so drift shows. The asset is
# compared beside its module for the target that writes one.
#
# Sourced by check-determinism.sh, which decides which vectors exist and counts
# what was compared; this only answers whether one of them held. Needs
# generated_file from generatedFile.sh, sourced by the caller.
#
# Usage: compare_vector_runs <label> <definitions-file> <target> <expected> \
#            <asset-expected> <work-dir>
# Returns non-zero on any mismatch, after naming it.
compare_vector_runs() {
  local label="$1" definitions="$2" target="$3" expected="$4" asset_expected="$5" work="$6"
  local result=0 first second first_asset second_asset
  # The generator names the file; each run is handed a directory of its own
  # and the file is read back out of it, so the two runs cannot see each
  # other's output.
  local dir_a="${work}/a" dir_b="${work}/b"
  # The whole command line is an array so every path arrives as one argument.
  # Built as a string it was split on spaces, and a corpus folder whose name
  # has one turned into a usage error about a flag nobody typed. The array
  # always holds the six fixed arguments, so it is never empty - which is
  # what `set -u` refuses to expand on the bash macOS still ships.
  local run_a=(--input "${definitions}" --target "${target}" --code "${dir_a}")
  local run_b=(--input "${definitions}" --target "${target}" --code "${dir_b}")
  if [ -f "${asset_expected}" ]; then
    run_a+=(--asset "${dir_a}/assets")
    run_b+=(--asset "${dir_b}/assets")
  fi
  # A run that died is not drift; `set -e` is off inside a function the
  # caller folds into its status, so the failure is named here.
  node bin/keewano-codegen.cjs "${run_a[@]}" > /dev/null \
    || { echo "RUN FAILED: ${label} exited non-zero" >&2; return 1; }
  node bin/keewano-codegen.cjs "${run_b[@]}" > /dev/null \
    || { echo "RUN FAILED: ${label} exited non-zero on the second run" >&2; return 1; }
  first="$(generated_file "${dir_a}")" || return 1
  second="$(generated_file "${dir_b}")" || return 1
  if ! cmp -s "${first}" "${second}"; then
    echo "NONDETERMINISTIC: ${label} differs between two runs" >&2
    result=1
  fi
  if ! cmp -s "${first}" "${expected}"; then
    echo "DRIFT: ${label} differs from the recorded vector" >&2
    result=1
  fi
  if [ -f "${asset_expected}" ]; then
    first_asset="$(generated_file "${dir_a}/assets")" || return 1
    second_asset="$(generated_file "${dir_b}/assets")" || return 1
    if ! cmp -s "${first_asset}" "${second_asset}"; then
      echo "NONDETERMINISTIC: ${label} asset differs between two runs" >&2
      result=1
    fi
    if ! cmp -s "${first_asset}" "${asset_expected}"; then
      echo "DRIFT: ${label} asset differs from the recorded vector" >&2
      result=1
    fi
  fi
  return "${result}"
}
