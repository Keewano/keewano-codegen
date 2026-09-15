/**
 * The type every generated reporter hangs off - `KeewanoSDK`. The surface
 * checks compare the bridge overloads a reporter calls; this is the other
 * half of the same claim, and the half a rename upstream breaks first: a
 * file full of correct calls still does not build if the type it extends
 * is gone.
 *
 * The name is read out of the SDK rather than written down here, and then
 * looked for in a recorded vector - so what is compared is our own output
 * against upstream, not one guess against another. The file arrives
 * resolved: the caller locates the whole surface as one checkout, so this
 * cannot read an entry point from a different clone than the bridge.
 */
'use strict';

const { readFileSync } = require('node:fs');

const { readOwnFile } = require('./ownFile.cjs');
const { stripComments } = require('./sourceText.cjs');

/**
 * Check that the entry point an SDK declares is the one our vectors extend.
 *
 * label - which SDK, for the messages.
 * path - the entry point's resolved file in the located checkout.
 * declaration - matches its declaration; the first capture is the name.
 * vector - repository-relative path of the recorded file to look in.
 * extend - renders what that file must contain for a given name.
 * Returns 0 when they agree, 1 otherwise.
 *
 * @param {{ label: string, path: string, declaration: RegExp, vector: string,
 *   extend: (name: string) => string }} args
 */
function checkEntryPoint({ label, path, declaration, vector, extend }) {
  const match = declaration.exec(stripComments(readFileSync(path, 'utf8')));
  if (match === null) {
    console.error(
      `${label}: no entry-point declaration in ${path} - it was renamed or moved, and ` +
        `every generated reporter extends it`,
    );
    return 1;
  }
  const name = match[1];
  const source = readOwnFile({ path: vector, wantedFor: 'the entry point it extends' });
  if (!source.includes(extend(name))) {
    console.error(
      `${label}: the SDK declares ${name}, which the recorded vectors do not extend - ` +
        `the emitted reporters would attach to nothing`,
    );
    return 1;
  }
  console.log(`${label}: the generated reporters still extend ${name}`);
  return 0;
}

module.exports = { checkEntryPoint };
