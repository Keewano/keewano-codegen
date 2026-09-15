/**
 * One file of the old per-event layout, read for the conversion.
 *
 * Two kinds of file are told apart. JSON of some other shape - the
 * manifest and the asset this tool wrote beside the definitions, a
 * sidecar another tool left - is skipped, as it always was. A file with
 * the old definition's own keys but a value the old format never
 * allowed is reported instead: skipped, it would drop an event without
 * a word, and every event after it would take a new id; and an id the
 * wire never had would count as no id at all, or sort the whole file,
 * which is the difference between keeping a numbering and replacing it.
 */

import type { LegacyRead } from './types/legacyEvent';

import { basename } from 'node:path';

import { readJsonFile } from '../shared/readJsonFile';
import { stringifyError } from '../shared/stringifyError';

import { isCustomEventId, isCustomEventType } from './customEventType';

/** The keys an old definition carried; one of them makes a file one. */
const LEGACY_KEYS = ['n', 't', 'id'] as const;

function readLegacyEvent(path: string): LegacyRead {
  const label = `parse: ${basename(path)}`;
  let json: unknown;
  try {
    json = readJsonFile({ path, label });
  } catch (error: unknown) {
    /** The read names the file itself; the listing names it once. */
    return { problem: stringifyError(error).replace(`${label}: `, '') };
  }
  /** Listed a moment ago and gone now: a link that leads nowhere, or a file vanishing under the read. */
  if (json === undefined) return { problem: 'cannot read file' };
  if (typeof json !== 'object' || json === null) return {};
  const record = json as Record<string, unknown>;
  if (!LEGACY_KEYS.some((key) => Object.hasOwn(record, key))) return {};
  return legacyEventOf(record);
}

/** The definition an old-shaped object declares, or what it got wrong. */
function legacyEventOf({ n, t, id }: Record<string, unknown>): LegacyRead {
  if (typeof n !== 'string') return { problem: '"n" is not a string' };
  if (!isCustomEventType(t)) return { problem: '"t" is not an event type' };
  if (id !== undefined && !isCustomEventId(id)) return { problem: '"id" is not an event id' };
  return { event: { name: n, type: t, id } };
}

export { readLegacyEvent };
