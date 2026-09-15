/**
 * The old layout, refused and rendered as the new file.
 *
 * This tool used to read a directory holding one JSON file per event,
 * `{ "id": 2500, "n": "Name", "t": 2 }`, with the id written by hand.
 * A project that still has one gets its events back in the shape the
 * tool reads now, ordered as they were numbered - by id where every file
 * carries one, by file name otherwise, which is how ids were assigned
 * before they were written down.
 *
 * The order is all the new file can keep. An id there is a position, so
 * a hand-written numbering with a gap, or one that started above the
 * first reserved id, cannot be expressed: every event after the gap takes
 * a new id. Those are listed beside the file rather than dropped
 * silently, because a set that shipped reports under the old numbers.
 *
 * What is not an old definition is skipped - the manifest and the asset
 * this tool wrote beside the definitions, a directory named like one,
 * the dot-prefixed sidecars macOS leaves next to a file on some volumes.
 * What cannot be read as one is listed beside the file too, by name and
 * reason, rather than refused on its own: a refusal would hide that
 * `--input` was a directory at all, and a silent skip would renumber
 * every event after a file that may have been one.
 */

import type {
  LegacyDescription,
  LegacyEvent,
  LegacyListing,
  RefuseLegacyDirectoryArgs,
  UnreadableFile,
} from './types/legacyDirectory';

import { readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import { compareOrdinal } from '../shared/compareOrdinal';
import { isNotFoundError } from '../shared/errno';
import { IoError, ParseError } from '../shared/errors';
import { stringifyError } from '../shared/stringifyError';

import { FIRST_CUSTOM_EVENT_ID } from './customEventType';
import { definitionEntry, renderDefinitions } from './definitionsDocument';
import { readLegacyEvent } from './legacyEvent';

/** `n` of something, with the noun in the number the count needs. */
const counted = (count: number, noun: string): string =>
  `${String(count)} ${noun}${count === 1 ? '' : 's'}`;

/**
 * A directory at `--input` is the old layout, and the reader who still
 * has one needs the file it became, not a complaint about a JSON
 * document that cannot be parsed. So the old files are read and printed
 * in the new shape, for the reader to save, together with what that
 * file could not carry: the files that could not be read as an old
 * definition, and every event whose id the move would change. A path
 * that is not there is left to the read, which reports it as missing.
 */
function refuseLegacyDirectory({ inputFile, label }: RefuseLegacyDirectoryArgs): void {
  let isDirectory: boolean;
  try {
    isDirectory = statSync(inputFile).isDirectory();
  } catch (error: unknown) {
    if (isNotFoundError(error)) return;
    throw new IoError(`${label}: cannot stat ${inputFile}: ${stringifyError(error)}`);
  }
  if (!isDirectory) return;
  const { text, renumbered, unreadable } = describeLegacyDirectory(inputFile);
  const notes: string[] = [];
  if (unreadable.length > 0) {
    const problems = unreadable.map((file) => `${file.name}: ${file.problem}`).join('; ');
    notes.push(
      `${label}: ${counted(unreadable.length, 'file')} could not be read as an old definition and ${unreadable.length === 1 ? 'is' : 'are'} missing from that file: ${problems}`,
    );
  }
  if (renumbered.length > 0) {
    const moved = renumbered
      .map((event) => `${event.name} ${String(event.oldId)} -> ${String(event.newId)}`)
      .join(', ');
    notes.push(
      `${label}: ${counted(renumbered.length, 'event')} would take a new id in that file (${moved}); a set that shipped keeps its ids only with a backend migration`,
    );
  }
  throw new ParseError(
    `${label}: a directory (the old per-event layout); as one file:\n${text}${notes.join('\n')}`,
  );
}

function describeLegacyDirectory(directory: string): LegacyDescription {
  const { events, unreadable } = readLegacyEvents(directory);
  const ordered = events.every((event) => event.id !== undefined)
    ? [...events].sort((left, right) => (left.id ?? 0) - (right.id ?? 0))
    : [...events].sort((left, right) => compareOrdinal(left.name, right.name));
  const definitions = {
    events: ordered.map((event) => definitionEntry({ name: event.name, type: event.type })),
  };
  const renumbered = ordered.flatMap((event, index) => {
    const newId = FIRST_CUSTOM_EVENT_ID + index;
    if (event.id === undefined || event.id === newId) return [];
    return [{ name: event.name, oldId: event.id, newId }];
  });
  return { text: renderDefinitions(definitions), renumbered, unreadable };
}

function readLegacyEvents(directory: string): LegacyListing {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error: unknown) {
    throw new IoError(`parse: cannot read ${directory}: ${stringifyError(error)}`);
  }
  const names = entries
    .filter((entry) => !entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .filter((name) => extname(name).toLowerCase() === '.json')
    .sort(compareOrdinal);
  const events: LegacyEvent[] = [];
  const unreadable: UnreadableFile[] = [];
  for (const name of names) {
    const { event, problem } = readLegacyEvent(join(directory, name));
    if (event !== undefined) events.push(event);
    if (problem !== undefined) unreadable.push({ name, problem });
  }
  return { events, unreadable };
}

export { refuseLegacyDirectory };
