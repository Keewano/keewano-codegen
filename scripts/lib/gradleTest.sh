#!/usr/bin/env bash
#
# Run the plugin's tests in the current directory, and refuse a run that
# executed none of them.
#
# `gradle test` exits 0 when it selects no tests at all - a renamed source set,
# a moved package, a test task filtered down to nothing - and a check that
# passes on an empty selection is the same failure as a comparison that
# compared nothing. So the count is read back out of the reports the run wrote.
#
# The reports are cleared first, because the count has to describe this run: a
# leftover directory from an earlier one answers for tests that were not
# selected now.
#
# Expects the plugin project as the working directory. Run, not sourced.
set -euo pipefail

results="build/test-results/test"
rm -rf "${results}"

gradle --no-daemon --quiet test

total=0
for report in "${results}"/TEST-*.xml; do
  [ -f "${report}" ] || continue
  count="$(grep -o 'tests="[0-9]*"' "${report}" | head -1 | tr -dc '0-9' || true)"
  total=$((total + ${count:-0}))
done

if [ "${total}" -eq 0 ]; then
  echo "check-plugin: gradle test selected no tests, so nothing was verified" >&2
  exit 1
fi

echo "check-plugin: ${total} plugin tests passed"
