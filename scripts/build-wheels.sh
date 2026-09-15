#!/usr/bin/env bash
#
# Pack each standalone executable into a Python wheel, one wheel per platform.
#
# A wheel is how Python delivers a binary: `pip install` picks the file whose
# platform tag matches the machine, unpacks it, and puts the console script on the
# path. Nothing is fetched afterwards and nothing is built on the customer's side,
# which is the point - the generator is not Python and cannot be built from Python
# source at all.
#
# Two hosts, one build. A developer here has no Python and gets it from a
# container; the pipeline has no Docker daemon - which is why check:native cannot
# run there either - and instead runs the job inside a Python image. The steps
# are written once and the only question is whether a container goes around them,
# because two copies of them would drift the day one was changed.
#
# Usage: npm run build:wheels   (after npm run build:binaries)
set -euo pipefail

# Git Bash rewrites the container-side paths below into Windows paths, so the
# staged wrapper arrives under a directory the container does not have and the
# build stops at the first `cd`. Turned off here rather than per invocation
# because every container path in this file has the problem.
export MSYS_NO_PATHCONV=1

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The version comes from package.json rather than being written twice: CI stamps
# that file before the build, so the wheels carry the release version without
# anything here knowing what a release is. A second copy would be one more thing
# to forget on the day it mattered.
version="$(cd "${root}" && node -p "require('./package.json').version")"
binaries="${root}/binaries"
wrapper="${root}/wrappers/python"
out="${root}/wheels"

# Pinned for the same reason the toolchain images are: a wheel is a build output.
#
# Newer than the oldest Python the wheel supports, and deliberately so: nothing in
# it is compiled against the interpreter, so the version that builds it need not be
# the version that runs it. What does matter is that the build backend understands
# the modern metadata, and the setuptools shipped with 3.8 does not - it wrote a
# package called UNKNOWN and failed.
image="python:3.12-slim"

# Which executable goes into which wheel, and the platform tag that tells pip who
# the wheel is for. The tag is what pip matches against the machine, so a wrong one
# installs cleanly and fails on the first run rather than being skipped - which is
# why these are written down rather than derived. The Windows entry differs in the
# name the executable takes inside the wheel, because the console script looks for
# an .exe there.
wheels="
keewano-codegen-linux-x64       manylinux2014_x86_64  keewano-codegen
keewano-codegen-linux-arm64     manylinux2014_aarch64 keewano-codegen
keewano-codegen-macos-arm64     macosx_11_0_arm64     keewano-codegen
keewano-codegen-macos-x64       macosx_10_9_x86_64    keewano-codegen
keewano-codegen-windows-x64.exe win_amd64             keewano-codegen.exe
"

missing=""
while read -r binary _ _; do
  [ -n "${binary}" ] || continue
  [ -f "${binaries}/${binary}" ] || missing="${missing} ${binary}"
done <<< "${wheels}"
if [ -n "${missing}" ]; then
  echo "build-wheels:${missing} not found in binaries/ - run npm run build:binaries first" >&2
  exit 1
fi

# A working python here means this already runs inside an image that has one,
# which is how the pipeline does it. Anywhere else the container supplies it.
#
# Asked by running it rather than by looking it up: Windows ships a stub named
# `python` that exists on the path, answers nothing, and exits 49 - so presence
# alone sent the build down the native path on a machine with no Python at all.
if python --version > /dev/null 2>&1; then
  native=1
  echo "build-wheels: building with the python on PATH"
else
  native=0
  echo "build-wheels: no python here, building in ${image}"
fi

rm -rf "${out}"
mkdir -p "${out}"

while read -r binary tag name; do
  [ -n "${binary}" ] || continue
  echo "build-wheels: ${tag}"
  # One staging tree per wheel: the wrapper sources plus the single executable
  # that wheel is for. Staged rather than built in place because the executable
  # has to sit inside the package directory under a fixed name, and no two wheels
  # can share one directory that holds one binary.
  stage="${out}/stage-${tag}"
  rm -rf "${stage}"
  cp -r "${wrapper}" "${stage}"
  # The licence lives at the repository root, not in the wrapper directory, so
  # nothing above copies it and every wheel would install without one. Named in
  # the wrapper's `license-files`, which resolves against this staging tree.
  cp "${root}/LICENSE" "${stage}/LICENSE"
  mkdir -p "${stage}/keewano_codegen/_bin"
  cp "${binaries}/${binary}" "${stage}/keewano_codegen/_bin/${name}"
  # Stamped into the copy, never into the source: the working tree keeps
  # whatever version package.json holds, and a build never leaves one behind.
  sed -i.bak "s/^version = \".*\"/version = \"${version}\"/" "${stage}/pyproject.toml"
  rm -f "${stage}/pyproject.toml.bak"

  # `--no-isolation` so the build runs against what is installed here rather than
  # fetching a fresh environment per wheel, and the platform tag is applied
  # afterwards: the backend has no idea which executable was staged, so it would
  # tag every wheel as pure Python and pip would install a macOS binary on Linux.
  #
  # The build directory is emptied first and is per wheel. `wheel tags` retags
  # every file the glob matches, and a leftover from the previous wheel retags
  # to the same name as this one - so the wrong executable wins the collision
  # and every wheel ships whichever binary was built first. Invisible on the
  # container path, where each wheel gets a fresh filesystem.
  steps="pip install --quiet --upgrade setuptools build wheel &&
    rm -rf /tmp/w && mkdir -p /tmp/w &&
    cd \"\$SRC\" && python -m build --wheel --no-isolation --outdir /tmp/w &&
    python -m wheel tags --platform-tag ${tag} --remove /tmp/w/*.whl &&
    cp /tmp/w/*.whl \"\$OUT\""
  if [ "${native}" = "1" ]; then
    SRC="${stage}" OUT="${out}" sh -c "${steps}"
  else
    docker run --rm -v "${stage}:/src" -v "${out}:/out" \
      -e SRC=/src -e OUT=/out "${image}" sh -c "${steps}"
  fi

  rm -rf "${stage}"
done <<< "${wheels}"

# Checked here rather than left to the driving check, which installs only the
# wheel for the host it runs on: a wheel carrying another platform's binary
# installs and reports nothing wrong until somebody on that platform runs it.
# The table is passed rather than repeated, so there is one list, not two.
triples=""
while read -r binary tag name; do
  [ -n "${binary}" ] || continue
  triples="${triples} ${binary} ${tag} ${name}"
done <<< "${wheels}"

if [ "${native}" = "1" ]; then
  python "${root}/scripts/lib/assert_wheel_binaries.py" "${out}" "${binaries}" ${triples}
else
  docker run --rm -v "${root}:/repo" -w /repo "${image}" \
    python scripts/lib/assert_wheel_binaries.py wheels binaries ${triples}
fi

echo "build-wheels: wheels written to ${out}"
