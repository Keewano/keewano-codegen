/**
 * The one comparison both surface checks make: what our surface claims that
 * the SDK does not publish. Only that direction is a failure - the SDKs carry
 * declarations we never generate against, and those are not our business.
 */
'use strict';

/**
 * Reports every entry `ours` declares that `upstream` lacks, and returns how
 * many there were, which is what the caller adds to its exit status.
 *
 * label - which SDK, for the message.
 * kind - what is being compared, for the message.
 * stamp - the checkout the upstream side was read from. The verdict is
 *   only as good as that tree, and a clone a few commits behind says
 *   exactly what a real removal says, so the sentence names it.
 */
function reportMissing({ label, kind, ours, upstream, stamp }) {
  const missing = ours.filter((entry) => !upstream.includes(entry));
  for (const entry of missing) {
    console.error(
      `${label} ${kind}: our surface declares "${entry}", which ${stamp} does not - ` +
        `a generated file written against it would not build`,
    );
  }
  return missing.length;
}

module.exports = { reportMissing };
