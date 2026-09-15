#!/usr/bin/env bash
#
# The generator names the file it writes; a caller sees only the directory it
# asked for. So the file is read back out of that directory - and there has to
# be exactly one, since a second would mean the run wrote something the vectors
# do not record. Prints the path; fails loudly on any other count.
#
# Sourced, not run, and free of side effects, so every check that reads a
# generated file back can source it from any working directory.
#
# Usage: generated_file <directory>
generated_file() {
  local found
  found="$(find "$1" -maxdepth 1 -type f)"
  if [ "$(printf '%s\n' "${found}" | grep -c .)" -ne 1 ]; then
    echo "expected one generated file under $1, found: ${found:-none}" >&2
    return 1
  fi
  printf '%s' "${found}"
}
