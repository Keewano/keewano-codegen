#!/usr/bin/env bash
#
# The Linux executable the container sourcing this can actually start.
#
# Resolved inside the container rather than passed in from the host. A container
# does not have to run under the host's architecture - forcing linux/amd64
# images is the ordinary setup on an Apple-silicon machine - and it is the
# container's own JVM that resolves the classifier the staged artifact has to
# match. Handed the host's answer, an amd64 container was staged an arm64
# executable under an arm64 classifier, and the build failed at resolution:
# a mismatch that reads as a broken wrapper.
#
# Sets `container_arch` and `container_binary`, and exits when there is no
# executable for this architecture or it was never built - both are a missing
# build step rather than a wrapper that disagrees with the generator, and saying
# so beats a comparison against a file that is not there.
#
# Expects the repository mounted at /repo. Sourced, not run.
case "$(uname -m)" in
  x86_64 | amd64) container_arch="x64" ;;
  aarch64 | arm64) container_arch="arm64" ;;
  *)
    echo "check-wrappers: no executable is published for $(uname -m)" >&2
    exit 1
    ;;
esac

container_binary="/repo/binaries/keewano-codegen-linux-${container_arch}"
if [ ! -f "${container_binary}" ]; then
  echo "check-wrappers: keewano-codegen-linux-${container_arch} is missing, run npm run build:binaries first" >&2
  exit 1
fi
