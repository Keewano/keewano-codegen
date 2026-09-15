#!/usr/bin/env bash
#
# Driving the standalone executable: which one this machine can run, and the
# comparison that proves it emits the recorded bytes. The executable carries its
# own runtime, so it is a second implementation path rather than the same one in
# a wrapper - shipping it unproven would move the contract off the thing
# everyone tests onto the thing everyone downloads.
#
# The host is resolved rather than assumed, because the cross-compiled targets
# sit in the same folder and cannot be executed here: a run that drove the wrong
# file would report an exec error as drift.
#
# Sets `host_binary` to the path when it is there, and to the empty string when
# there is none for this host. An executable that is present but unusable - not
# runnable, or older than the build it should mirror - is neither: it is a wrong
# build rather than an absent one, so it exits instead of resolving to nothing.
# Sourced, not run.
host_binary=""

# The architecture decides as much as the operating system does: an arm64 Linux
# runner has the x64 build sitting in the same folder and cannot run a byte of
# it, and calling that drift would fail the check on a machine nothing is wrong
# with. An arch we publish no build for resolves to nothing instead.
host_platform=""
case "$(uname -s)/$(uname -m)" in
  Linux/x86_64) host_platform="linux-x64" ;;
  Linux/aarch64 | Linux/arm64) host_platform="linux-arm64" ;;
  Darwin/arm64) host_platform="macos-arm64" ;;
  Darwin/x86_64) host_platform="macos-x64" ;;
  MINGW*/x86_64 | MSYS*/x86_64 | CYGWIN*/x86_64) host_platform="windows-x64.exe" ;;
esac

if [ -n "${host_platform}" ]; then
  host_candidate="binaries/keewano-codegen-${host_platform}"
  # Present but not runnable is a broken build, not an absence. Reading it as
  # one would let the caller report "nothing to check here" and exit clean on
  # the very run that produced an executable nobody can start.
  if [ -f "${host_candidate}" ] && [ ! -x "${host_candidate}" ]; then
    echo "${host_candidate} is not executable, so it was built wrong" >&2
    exit 1
  fi
  # Presence says nothing about the build behind it, which is the reason the
  # caller refuses a stale dist/. Two names are watched, and between them they
  # cover everything the executable is built from.
  #
  # dist/src/cli/run.js stands for the whole of dist, not only for itself: tsc
  # is not incremental here, so every build rewrites every output and that one
  # file's timestamp moves whenever any source does. Naming the other modules
  # the bundle pulls in - the exit-code contract among them - would add second
  # names for a signal already carried, not a signal that is missing.
  #
  # bin/keewano-codegen.cjs is watched because dist cannot speak for it: it is
  # the entry the compiler starts from, and editing it alone leaves dist
  # untouched.
  if [ -f "${host_candidate}" ] && { [ "dist/src/cli/run.js" -nt "${host_candidate}" ] \
    || [ "bin/keewano-codegen.cjs" -nt "${host_candidate}" ]; }; then
    echo "${host_candidate} is older than what it was built from: run npm run build:binaries first" >&2
    exit 1
  fi
  if [ -x "${host_candidate}" ]; then
    host_binary="${host_candidate}"
  fi
fi

# Reading a generated file back out of the directory a run was handed lives
# beside the other checks that need it; sourced by this file's own location so
# the caller's working directory does not matter.
. "$(dirname "${BASH_SOURCE[0]}")/generatedFile.sh"

# Generate one vector through the executable and compare it, and its asset when
# the target writes one, against the recording.
#
# Usage: compare_through_binary <label> <definitions-file> <target> <work-dir> \
#            <expected> <asset-expected>
# The work directory receives the generated file, and `assets/` under it the
# asset. Returns non-zero on any mismatch, so the caller folds it into its own
# status.
compare_through_binary() {
  local label="$1" input="$2" target="$3" work_dir="$4" expected="$5" asset_expected="$6"
  local result=0 output asset_output
  # The optional flag is an array for the same reason the caller builds its
  # whole command line as one: expanded from a string it is split on spaces,
  # and these paths carry the corpus directory's name. A folder with a space
  # in it arrived as two arguments and the run died on a flag nobody typed.
  #
  # Expanded through `+` rather than as `"${asset_argument[@]}"`, because bash
  # 3.2 - what macOS still ships - treats an empty array as unset, and under
  # `set -u` that aborts the run for every target that writes no asset. The
  # `-` form survives it but substitutes one empty string, which the CLI then
  # rejects as a flag with no value; `+` yields nothing at all when empty and
  # still passes a path with a space as one argument when filled.
  local asset_argument=()

  if [ -f "${asset_expected}" ]; then
    asset_argument=(--asset "${work_dir}/assets")
  fi
  # A run that died is not drift, and calling it that sends the reader to diff
  # two files when one of them was never written.
  if ! "./${host_binary}" --input "${input}" --target "${target}" --code "${work_dir}" \
    ${asset_argument[@]+"${asset_argument[@]}"} > /dev/null; then
    echo "BINARY FAILED: ${label} - ${host_binary} exited non-zero" >&2
    return 1
  fi
  # Assigned apart from the declaration: `local x="$(...)"` reports the
  # declaration's status, and a directory with no file in it would read as a match.
  output="$(generated_file "${work_dir}")" || return 1
  if ! cmp -s "${output}" "${expected}"; then
    echo "BINARY DRIFT: ${label} differs from the recorded vector" >&2
    result=1
  fi
  if [ -f "${asset_expected}" ]; then
    asset_output="$(generated_file "${work_dir}/assets")" || return 1
    if ! cmp -s "${asset_output}" "${asset_expected}"; then
      echo "BINARY DRIFT: ${label} asset differs from the recorded vector" >&2
      result=1
    fi
  fi
  return "${result}"
}
