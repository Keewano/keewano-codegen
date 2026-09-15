#!/usr/bin/env bash
#
# Assemble the `.artifactbundle` Swift Package Manager resolves the executable
# from.
#
# SPM has no binary registry: it resolves packages from git, and an executable of
# this size cannot live in a repository. So Apple's answer is a bundle published
# somewhere and named by URL and checksum from `Package.swift` - which is how
# SwiftLint and swift-format ship, and the only shape available.
#
# Linux variants are included even though the audience is iOS. They cost nothing,
# they let the whole chain be proven on a machine that is not a Mac, and SPM runs
# on Linux too.
#
# Usage: npm run build:bundle   (after npm run build:binaries)
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
binaries="${root}/binaries"
# Inside the Swift package, because SPM refuses a binary target path that leaves
# the package root - a bundle kept beside the repository resolved on a laptop and
# failed the moment anything consumed the package.
out="${root}/wrappers/spm/artifacts"
bundle="${out}/keewano-codegen.artifactbundle"
version="$(cd "${root}" && node -p "require('./package.json').version")"

# The triple is how SPM decides which variant this machine can run. Written down
# rather than derived: a wrong one resolves cleanly and fails on the first
# execution, which is a worse failure than not matching at all.
variants="
keewano-codegen-macos-arm64 arm64-apple-macosx
keewano-codegen-macos-x64   x86_64-apple-macosx
keewano-codegen-linux-x64   x86_64-unknown-linux-gnu
keewano-codegen-linux-arm64 aarch64-unknown-linux-gnu
"

missing=""
while read -r binary _; do
  [ -n "${binary}" ] || continue
  [ -f "${binaries}/${binary}" ] || missing="${missing} ${binary}"
done <<< "${variants}"
if [ -n "${missing}" ]; then
  echo "build-bundle:${missing} not found in binaries/ - run npm run build:binaries first" >&2
  exit 1
fi

rm -rf "${bundle}"
mkdir -p "${bundle}"

entries=""
while read -r binary triple; do
  [ -n "${binary}" ] || continue
  mkdir -p "${bundle}/${binary}/bin"
  cp "${binaries}/${binary}" "${bundle}/${binary}/bin/keewano-codegen"
  chmod +x "${bundle}/${binary}/bin/keewano-codegen"
  [ -z "${entries}" ] || entries="${entries},"
  entries="${entries}
        {
          \"path\": \"${binary}/bin/keewano-codegen\",
          \"supportedTriples\": [\"${triple}\"]
        }"
done <<< "${variants}"

cat > "${bundle}/info.json" <<JSON
{
  "schemaVersion": "1.0",
  "artifacts": {
    "keewano-codegen": {
      "type": "executable",
      "version": "${version}",
      "variants": [${entries}
      ]
    }
  }
}
JSON

echo "build-bundle: ${bundle}"
