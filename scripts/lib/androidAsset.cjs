/**
 * The other half of the Android contract: not the calls a generated file
 * makes, but the file the SDK reads at launch. It answers two questions the
 * bridge comparison cannot - whether the SDK still looks the asset up under
 * the name the emitter writes, and whether it still reads the three keys the
 * asset carries. The reader arrives resolved: the caller locates the whole
 * surface as one checkout, so this cannot read an asset reader from a
 * different clone than the bridge.
 */
'use strict';

const { readFileSync } = require('node:fs');

const { requireBuiltRegistry } = require('./builtRegistry.cjs');
const { stripComments } = require('./sourceText.cjs');

/**
 * The name comes from the built registry rather than a copy kept here,
 * so a rename on our side cannot leave this check green while the SDK
 * opens a file nothing produces. That makes a current build the
 * precondition - a missing or stale one arrives as a sentence naming
 * the step owed, not as a loader stack or a silently old name.
 */
const assetFileNameFor = (() => {
  try {
    return requireBuiltRegistry().assetFileNameFor;
  } catch (error) {
    console.error(`android: ${error.message}`);
    process.exit(1);
  }
})();

/**
 * The name the emitter actually writes, read off the built registry. A
 * copy kept here would let our own side rename the artifact and leave
 * this check green while the SDK opened a file nothing produces.
 */
const ASSET_NAME = assetFileNameFor('kotlin');

/** Every key the SDK reads out of the emitted asset. */
const ASSET_KEYS = ['version', 'eventCount', 'gzipBase64'];

/**
 * A key counts as read only where the SDK reads it. The shape is half of that;
 * the other half is that comments are gone before this runs, because the file
 * documents its own asset and a commented `getString("version")` reads exactly
 * like the call it describes.
 */
const readsKey = (source, key) => new RegExp(String.raw`get\w+\("${key}"\)`).test(source);

/**
 * Compare the asset contract against the SDK's resolved asset reader.
 * Returns 0 when it holds, 1 otherwise.
 *
 * @param {{ path: string }} args
 */
function checkAssetContract({ path }) {
  /** The prose around these declarations names the asset and its keys too. */
  const source = stripComments(readFileSync(path, 'utf8'));
  /** Where the SDK declares the name, not wherever the text appears. */
  if (!new RegExp(String.raw`=\s*"${ASSET_NAME}"`).test(source)) {
    console.error(
      `android: the SDK no longer looks up "${ASSET_NAME}" - the emitted asset would never be read`,
    );
    return 1;
  }
  const unread = ASSET_KEYS.filter((key) => !readsKey(source, key));
  if (unread.length > 0) {
    console.error(
      `android: the SDK no longer reads ${unread.join(', ')} out of the asset - ` +
        `the emitted set would be dropped at launch`,
    );
    return 1;
  }
  console.log(
    `android: the SDK still reads "${ASSET_NAME}" and all ${ASSET_KEYS.length} of its keys`,
  );
  return 0;
}

module.exports = { checkAssetContract };
