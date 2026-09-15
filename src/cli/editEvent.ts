/**
 * Rename one event in place. Only the name changes: the entry keeps its
 * position, so its id, because recorded data was written under that id,
 * and it keeps its payload type because past occurrences carry the old
 * one - an event that needs a different type is a different event, and
 * adding it is the honest way to get one.
 */

import type { EditEventArgs } from './types/editEvent';

import { parseEventDefinitions } from '../events/parseEventDefinitions';
import { ParseError } from '../shared/errors';

import { CLI_DEFAULTS } from './defaults';
import { writeDefinitions } from './definitionsFile';
import { assertNameIsUsable } from './eventNameGuard';

function editEvent({ name, rename, input }: EditEventArgs): void {
  if (rename === name) {
    throw new ParseError(`edit: "${name}" is already its name`);
  }
  const { definitions, events } = parseEventDefinitions({ inputFile: input });
  const event = events.find((candidate) => candidate.name === name);
  if (event === undefined) {
    throw new ParseError(`edit: no event named "${name}"`);
  }
  assertNameIsUsable({ name: rename, events, replacing: name });
  definitions.events = definitions.events.map((entry) =>
    entry.eventName === name ? { ...entry, eventName: rename } : entry,
  );
  writeDefinitions({ inputFile: input, definitions });
  process.stdout.write(
    `${CLI_DEFAULTS.PROGRAM_NAME}: renamed ${name} to ${rename} in ${input} (id ${event.id} unchanged)\n`,
  );
}

export { editEvent };
