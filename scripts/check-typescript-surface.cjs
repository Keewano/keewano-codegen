/**
 * Compare the TypeScript surface in `conformance/__sdk-surfaces/sdk-modules.d.ts`
 * against what the TypeScript SDK declares: the set a generated module exports
 * and the entry shape inside it.
 *
 * Kotlin, Swift and Python each get compared to a real checkout; TypeScript did
 * not, so the stub was free to say anything. The recorded vectors are
 * type-checked against the stub, which proves they agree with it and nothing
 * else - and the stub is the one file in this repository that is supposed to be
 * a copy of somebody else's.
 *
 * Both directions are printed and neither fails the run, which is deliberate.
 * This pair is meant to move apart: the generated file carries a field first
 * and the SDK grows it after, so failing on the difference would block this
 * repository on the other one merging - the lag is the plan. What was missing
 * was not a gate but a statement, so each difference is named with the commit
 * it was measured against and the run says which way it points.
 *
 * A run that compared nothing still fails, exactly as the other three do: an
 * absent checkout is not agreement.
 *
 * Usage: npm run check:surfaces   (KEEWANO_SDKS_DIR names a directory of
 * checkouts, KEEWANO_TS_SDK points at one or at the compared file;
 * KEEWANO_ALLOW_SKIP=1 accepts a run that verified nothing)
 */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const { findUpstreamCheckout } = require('./find-upstream.cjs');
const { stampFor } = require('./lib/checkoutStamp.cjs');
const { readOwnFile } = require('./lib/ownFile.cjs');
const { declaredFields, inlineFields } = require('./lib/typeScriptFields.cjs');

const ROOT = resolve(__dirname, '..');
const SDKS_DIR = process.env.KEEWANO_SDKS_DIR;
const UPSTREAM_SET = 'packages/core/src/network/types/customEventSet.ts';
const OURS_TYPESCRIPT = 'conformance/__sdk-surfaces/sdk-modules.d.ts';

/** The same shape under the name each side gives it. */
const SET = { upstream: 'CustomEventSet', ours: 'KeewanoCustomEventSet' };
const ENTRY_FIELD = 'events';

/**
 * A surface that reads as empty is never a pass: upstream it means the file
 * moved or changed shape and this stopped reading it, on our side it means
 * there was nothing to compare. An empty list agrees with everything.
 */
function assertRead({ fields, path, what }) {
  if (fields.length > 0) return;
  throw new Error(`typescript: read no ${what} out of ${path}, so there was nothing to compare`);
}

/** One pair of field lists, each difference named with the direction it points. */
function compareFields({ what, ours, upstream, stamp }) {
  const ahead = ours.filter((field) => !upstream.includes(field));
  for (const field of ahead) {
    console.log(
      `typescript ${what}: our surface declares "${field}" and ${stamp} does not yet - ` +
        `a generated file using it does not build against that checkout`,
    );
  }
  const behind = upstream.filter((field) => !ours.includes(field));
  for (const field of behind) {
    console.log(
      `typescript ${what}: ${stamp} declares "${field}" and our surface does not, so the ` +
        `recorded vectors are not checked against it`,
    );
  }
  return ahead.length + behind.length;
}

/** @param {string[]} paths - the file declaring the set, one checkout. */
function compareTypeScript([setPath]) {
  const upstreamSource = readFileSync(setPath, 'utf8');
  const ourSource = readOwnFile({
    path: OURS_TYPESCRIPT,
    wantedFor: 'the surface it compares',
  });
  const stamp = stampFor(setPath);

  const upstreamSet = declaredFields({ source: upstreamSource, name: SET.upstream });
  const ourSet = declaredFields({ source: ourSource, name: SET.ours });
  assertRead({ fields: upstreamSet, path: UPSTREAM_SET, what: 'set fields' });
  assertRead({ fields: ourSet, path: OURS_TYPESCRIPT, what: 'set fields' });

  /**
   * The SDK gives the entry its own interface and the stub spells it inline,
   * so each side is read the way it is written rather than being made to match.
   */
  const upstreamEntry = declaredFields({ source: upstreamSource, name: 'CustomEventDef' });
  const ourEntry = inlineFields({ source: ourSource, name: SET.ours, field: ENTRY_FIELD });
  assertRead({ fields: upstreamEntry, path: UPSTREAM_SET, what: 'event fields' });
  assertRead({ fields: ourEntry, path: OURS_TYPESCRIPT, what: 'event fields' });

  const differences =
    compareFields({ what: 'set', ours: ourSet, upstream: upstreamSet, stamp }) +
    compareFields({ what: 'event', ours: ourEntry, upstream: upstreamEntry, stamp });
  const state = differences === 0 ? 'in step with' : `${differences} field(s) apart from`;
  console.log(
    `typescript: ${ourSet.length} set fields and ${ourEntry.length} event fields, ${state} ${stamp}`,
  );
  /** The difference is reported, never fatal; only a comparison that did not happen is. */
  return 0;
}

const typescript = findUpstreamCheckout({
  suffixes: [UPSTREAM_SET],
  overrideEnv: 'KEEWANO_TS_SDK',
  repoRoot: ROOT,
  sdksDirectory: SDKS_DIR,
});

let status = 0;
if (typescript.paths === null) {
  console.error(
    `typescript: no checkout carrying ${UPSTREAM_SET} was found, so the surface was not ` +
      `compared - looked under ${typescript.searched.join(', ')}` +
      (typescript.nearMiss === undefined ? '' : `; ${typescript.nearMiss}`),
  );
  /** A typo in a variable somebody set on purpose is never an unverified run to accept. */
  if (typescript.overrideFailed === true || process.env.KEEWANO_ALLOW_SKIP !== '1') status = 1;
} else {
  status = compareTypeScript(typescript.paths);
}

process.exit(status === 0 ? 0 : 1);
