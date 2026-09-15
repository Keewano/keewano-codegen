#!/usr/bin/env bash
#
# The wheel's launcher answers for itself.
#
# The launcher is the only code in the wheel that is not the generator, and the
# part of it that matters is the recovery: an installed executable that lost its
# bit, in a site-packages the caller does not own. That branch is the one a
# consumer hits and the one no other check reaches - check-wheel.sh installs as
# the owner, so the chmod there always succeeds and the copy is never made.
#
# Two hosts, one command, the same shape as build-wheels.sh: a developer here
# has no Python and gets it from a container; the pipeline has no Docker daemon
# and instead runs the job inside a Python image, where the interpreter is on
# the path and the container is skipped.
#
# Usage: npm run check:launcher
set -euo pipefail

# Git Bash rewrites the container-side paths below into Windows paths, so the
# mounted tests arrive under a directory the container does not have.
export MSYS_NO_PATHCONV=1

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
wrapper="${root}/wrappers/python"

# Pinned for the same reason build-wheels.sh pins it: this is a build tool.
image="python:3.12-slim"

# Asked by running it rather than by looking it up: Windows ships a stub named
# `python` that exists on the path, answers nothing, and exits 49 - so presence
# alone sent the run down the native path on a machine with no Python at all.
if python --version > /dev/null 2>&1; then
  echo "check-launcher: running with the python on PATH"
  cd "${wrapper}" && python -m unittest discover --start-directory tests --verbose
else
  echo "check-launcher: no python here, running in ${image}"
  # Mounted read-write because unittest writes __pycache__ beside what it
  # imports, and a read-only mount fails the import rather than the test.
  docker run --rm -v "${wrapper}:/w" -w /w "${image}" \
    python -m unittest discover --start-directory tests --verbose
fi
