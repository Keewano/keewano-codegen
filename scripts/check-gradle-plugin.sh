#!/usr/bin/env bash
#
# The Gradle plugin's own unit tests.
#
# They exist and nothing runs them: `build:ci` is an npm task list in a Node
# image, which has no JVM, and check-wrappers.sh drives the plugin end to end
# without ever invoking `gradle test`. So the classifier table and the
# executable-recovery both had tests that could not fail a pipeline, which is
# the same as not having them.
#
# Two hosts, one command, the same shape as build-wheels.sh: a developer here
# has no Gradle and gets it from a container; the pipeline has no Docker daemon
# and instead runs the job inside a Gradle image, where the toolchain is on the
# path and the container is skipped.
#
# Usage: npm run check:plugin
set -euo pipefail

# Git Bash rewrites the container-side paths below into Windows paths, so the
# mounted plugin arrives under a directory the container does not have.
export MSYS_NO_PATHCONV=1

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Pinned to the image check-wrappers.sh drives the plugin with, so a test that
# passes here and a wrapper that works there agree on the toolchain.
image="gradle:8.10-jdk17"

if gradle --version > /dev/null 2>&1; then
  echo "check-plugin: running with the gradle on PATH"
  cd "${root}/wrappers/gradle" && bash "${root}/scripts/lib/gradleTest.sh"
else
  echo "check-plugin: no gradle here, running in ${image}"
  # Copied out of a read-only mount rather than built in place, exactly as
  # check-wrappers.sh does: the build writes into the project directory, and a
  # container writing into the checkout leaves root-owned output behind.
  #
  # Both paths run the same script, so the refusal of an empty test selection
  # is written once and cannot hold on one host and not the other.
  docker run --rm -v "${root}:/repo:ro" -v keewano-gradle-cache:/home/gradle/.gradle \
    "${image}" bash -c '
      set -e
      cp -r /repo/wrappers/gradle /plugin
      cd /plugin
      bash /repo/scripts/lib/gradleTest.sh
    '
fi
