/**
 * The classifiers the Gradle plugin resolves are the executables the build
 * produces.
 *
 * The platform names are written down twice - once as bun targets in
 * build-binaries.cjs, once as Maven classifiers in the plugin's when - and
 * nothing else connects them: Maven metadata does not enumerate classifiers,
 * so a name that drifts resolves to a 404 in the consumer's build and nowhere
 * before that. This compares the two sets both ways, so a classifier nothing
 * builds and a target the plugin cannot resolve both fail here.
 *
 * The targets are read from build-binaries.cjs rather than from binaries/, the
 * same registry check-platform-tables answers to. Read from the directory the
 * two checks disagreed about what "built" meant: a partial build reported four
 * classifiers as unbuilt on a run where nothing was wrong with the plugin, and
 * a fresh clone could not run this at all. Whether a declared target really
 * produced a file is build:binaries' own job, which fails outright when a
 * compile does.
 *
 * Runs inside `build:ci` beside check-platform-tables. Needs nothing but the
 * repository.
 */
'use strict';

const { readOwnFile } = require('./lib/ownFile.cjs');
const { readBuiltPlatforms } = require('./lib/platformTables.cjs');

const CLASSIFIER_SOURCE = 'wrappers/gradle/src/main/kotlin/com/keewano/codegen/HostClassifier.kt';

/** The classifiers as the plugin states them; an empty parse is a reshaped function, never a pass. */
function readClassifiers() {
  const source = readOwnFile({ path: CLASSIFIER_SOURCE, wantedFor: 'the classifiers it compares' });
  const body = source.slice(source.indexOf('internal fun hostClassifier(osName'));
  const classifiers = new Set([...body.matchAll(/->\s*"([a-z0-9-]+)"/g)].map((hit) => hit[1]));
  if (classifiers.size === 0) {
    throw new Error(
      `no classifiers parsed from ${CLASSIFIER_SOURCE}: the function moved or was reshaped`,
    );
  }
  return classifiers;
}

const classifiers = readClassifiers();
const built = readBuiltPlatforms();
const unresolvable = [...built].filter((platform) => !classifiers.has(platform));
const unbuilt = [...classifiers].filter((classifier) => !built.has(classifier));

for (const platform of unresolvable) {
  process.stderr.write(
    `check-host-classifiers: ${platform} is a build target but the Gradle plugin never resolves it\n`,
  );
}
for (const classifier of unbuilt) {
  process.stderr.write(
    `check-host-classifiers: the Gradle plugin resolves ${classifier} but nothing builds it\n`,
  );
}
if (unresolvable.length + unbuilt.length > 0) process.exit(1);

process.stdout.write(
  `check-host-classifiers: ${String(classifiers.size)} classifiers, each one a build target\n`,
);
