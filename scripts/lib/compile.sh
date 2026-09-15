#!/usr/bin/env bash
#
# The plumbing check-native-vectors.sh needs to run a compiler in a container
# and report what happened. It is here rather than inline because it is about
# running things, not about Swift or Kotlin, and the script that is about those
# two reads better without it.
#
# Sourced, never executed: it defines functions and touches `status`, which the
# caller owns.

# A compiler's verdict is its exit status. Matching its output for "error:"
# reads as equivalent and is not: a rejected file can be described entirely in
# `note:` lines - an unclosed brace is - and grepping would call that a pass.
# Failing output is printed instead of matched, so the reason is visible.
run_compiler() {
  local label="$1"
  shift
  local output
  if output="$("$@" 2>&1)"; then
    echo "${label}: compiles"
  else
    echo "${label}: does not compile" >&2
    echo "${output}" >&2
    status=1
  fi
}

# A toolchain that never ran verified nothing, so it must not read as a pass -
# that is the same failure as a green check that matched no output.
# KEEWANO_ALLOW_SKIP=1 is the deliberate way to accept an unverified run.
report_missing_toolchain() {
  # An image docker could not fetch is a failed verification, never a skip:
  # the machine can run the compiler, so no flag should wave it through.
  #
  # Defaulted rather than read bare: the caller runs under `set -u`, where a
  # report reached without `have_image` having set this would abort the whole
  # script on an unbound variable instead of saying what was not verified.
  if [ "${toolchain_absent:-1}" = "0" ]; then
    echo "$1: docker is running but its pinned image could not be fetched, so nothing was verified" >&2
    status=1
    return
  fi
  if [ "${KEEWANO_ALLOW_SKIP:-0}" = "1" ]; then
    echo "$1: no toolchain available, skipped on request" >&2
  else
    echo "$1: no toolchain available, nothing was verified (KEEWANO_ALLOW_SKIP=1 accepts that)" >&2
    status=1
  fi
}

# An unmatched glob expands to itself, so a corpus that lost its vectors would
# hand the compiler a path that is not there and read as a compile failure. The
# difference matters: one is broken output, the other is missing input.
require_vectors() {
  if [ ! -f "$1" ]; then
    echo "$2: no recorded vectors found, nothing was verified" >&2
    status=1
    return 1
  fi
}

# Whether this image can be run here, and which kind of no it is.
#
# A docker that is not installed, or whose daemon is not reachable, is a
# machine that cannot verify - which is what KEEWANO_ALLOW_SKIP exists to
# accept. An image that could not be fetched is not that: docker works, the
# tag is pinned, and a run that failed to get it verified nothing while
# reading exactly like an ordinary skip. The two are told apart here so the
# report below can refuse to waive the second.
#
# The pull is not silenced: these images are gigabytes, and a first run that
# looks hung for ten minutes is worse than a progress bar.
have_image() {
  if ! docker info > /dev/null 2>&1; then
    toolchain_absent=1
    return 1
  fi
  docker image inspect "$1" > /dev/null 2>&1 && return 0
  docker pull "$1" && return 0
  toolchain_absent=0
  return 1
}
