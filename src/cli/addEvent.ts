/**
 * Declare one event without opening the definitions file. The point of
 * the command is that the file's shape is this tool's vocabulary, not the
 * caller's: they pick a name and a payload type, and the entry that gets
 * written is the one they would have had to write by hand.
 *
 * Appended, never inserted. An id is the entry's position in the file,
 * so the end is the one place a new entry can go without moving another
 * - and an entry that moved reports under a number the backend has never
 * seen it on.
 */

import type { AddEventArgs } from './types/addEvent';

import { FIRST_CUSTOM_EVENT_ID, isCustomEventId } from '../events/customEventType';
import { definitionEntry } from '../events/definitionsDocument';
import { ParseError } from '../shared/errors';

import { CLI_DEFAULTS } from './defaults';
import { loadDefinitionsOrEmpty, writeDefinitions } from './definitionsFile';
import { assertNameIsUsable } from './eventNameGuard';

function addEvent({ name, type, input }: AddEventArgs): void {
  const { definitions, events } = loadDefinitionsOrEmpty(input);
  assertNameIsUsable({ name, events });
  const id = FIRST_CUSTOM_EVENT_ID + events.length;
  /** Refused here rather than by the parser on the next run, so a file no run can read is never written. */
  if (!isCustomEventId(id)) {
    throw new ParseError('add: no event id left in the wire range');
  }
  definitions.events.push(definitionEntry({ name, type }));
  writeDefinitions({ inputFile: input, definitions });
  process.stdout.write(`${CLI_DEFAULTS.PROGRAM_NAME}: added ${name} as id ${id} in ${input}\n`);
}

export { addEvent };
