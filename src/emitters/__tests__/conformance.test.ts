/**
 * Byte-exact conformance against the golden vectors under
 * `conformance/`; the version stamps are recorded in
 * `conformance/versions.json`.
 *
 * The expected files were produced before this repository existed, by
 * the generator that ran inside the SDK itself and used the SDK's own
 * byte encoder and hash. The encoders in `src/set/` are an independent
 * re-implementation of that contract, so these vectors are what proves
 * the two agree - the only cross-check available to a package that
 * deliberately depends on no SDK.
 *
 * The two halves are not equally frozen. `versions.json` is the wire
 * contract - a set's identity - and is never re-recorded: a change there
 * means the server would see a second schema where there is one, so the
 * code is what gets fixed. The `expected/*.generated.ts` files are
 * rendering snapshots; when the template deliberately changes, they are
 * re-recorded in that same commit, and the untouched version stamps are
 * what prove only the rendering moved.
 */
import type { EmitTarget } from '../types/emit';

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

import { DEFINITIONS_FILE_NAME } from '../../events/definitionsDocument';
import { parseEventDefinitions } from '../../events/parseEventDefinitions';
import { buildCustomEventSet } from '../../set/buildCustomEventSet';
import { compareOrdinal } from '../../shared/compareOrdinal';
import { renderAssetJson } from '../assetJson';
import { emitGeneratedSource } from '../emit';
import { TARGET_NAMES, assetFileNameFor, generatedFileNameFor } from '../registry';

/** How a target's vector is named: the target, then the extension its generated file takes. */
const vectorName = (target: EmitTarget): string =>
  `${target}.generated${extname(generatedFileNameFor(target))}`;

/** How a target's asset vector is named, when the target emits one. */
const assetVectorName = (target: EmitTarget): string => `${target}.generated.asset.json`;

const ROOT = join(__dirname, '..', '..', '..', 'conformance');

const versions = JSON.parse(readFileSync(join(ROOT, 'versions.json'), 'utf8')) as Record<
  string,
  { version: number; eventCount: number }
>;

/** A corpus is a folder with definitions in it; `__sdk-surfaces/` holds what the vectors compile against. */
const sets = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => existsSync(join(ROOT, name, 'input')))
  .sort(compareOrdinal);

describe.each(sets)('conformance set %s', (set) => {
  const { events } = parseEventDefinitions({
    inputFile: join(ROOT, set, 'input', DEFINITIONS_FILE_NAME),
  });

  it('reproduces the recorded version and event count', () => {
    const built = buildCustomEventSet(events);
    expect(built.version).toBe(versions[set]?.version);
    expect(built.eventCount).toBe(versions[set]?.eventCount);
  });

  it('has every recorded artifact per registered target and no stale ones', () => {
    /**
     * The expected file list is derived from the registry, so a target
     * that grows a second artifact (the kotlin asset) is covered the
     * moment it is declared, and a leftover file fails rather than
     * sitting unread.
     */
    const expected = TARGET_NAMES.flatMap((target) => {
      const artifacts = [vectorName(target)];
      if (assetFileNameFor(target) !== undefined) artifacts.push(assetVectorName(target));
      return artifacts;
    }).sort(compareOrdinal);
    const recorded = readdirSync(join(ROOT, set, 'expected')).sort(compareOrdinal);
    expect(recorded).toEqual(expected);
  });

  it.each(TARGET_NAMES)('renders the %s target byte for byte', (target) => {
    const expected = readFileSync(join(ROOT, set, 'expected', vectorName(target)), 'utf8');
    expect(emitGeneratedSource({ events, target })).toBe(expected);
  });

  it.each(TARGET_NAMES.filter((target) => assetFileNameFor(target) !== undefined))(
    'renders the %s definition-set asset byte for byte',
    (target) => {
      const expected = readFileSync(join(ROOT, set, 'expected', assetVectorName(target)), 'utf8');
      expect(renderAssetJson({ events })).toBe(expected);
    },
  );
});

it('covers every set that has an expected directory', () => {
  /**
   * The count is stated so a corpus cannot disappear unnoticed - moving
   * it is then a deliberate edit here. Four today: no events at all, one
   * event, ten covering every payload type, and the ordering cases.
   */
  expect(sets.length).toBeGreaterThanOrEqual(4);
  expect(Object.keys(versions).sort(compareOrdinal)).toEqual(sets);
});
