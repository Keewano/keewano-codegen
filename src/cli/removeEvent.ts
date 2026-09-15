/**
 * Take one event out of the set: the entry goes, and every entry after it
 * moves down one id, since an id is a position in the file. This is for
 * an event that is not used anymore and is not planned to be used in the
 * future. When events follow the removed entry, a second output line
 * lists them, because their ids have just changed.
 */

import type { RemoveEventArgs } from './types/removeEvent';

import { parseEventDefinitions } from '../events/parseEventDefinitions';
import { ParseError } from '../shared/errors';

import { CLI_DEFAULTS } from './defaults';
import { writeDefinitions } from './definitionsFile';

function removeEvent({ name, input }: RemoveEventArgs): void {
  const { definitions, events } = parseEventDefinitions({ inputFile: input });
  const event = events.find((candidate) => candidate.name === name);
  if (event === undefined) {
    throw new ParseError(`remove: no event named "${name}"`);
  }
  definitions.events = definitions.events.filter((entry) => entry.eventName !== name);
  writeDefinitions({ inputFile: input, definitions });
  process.stdout.write(`${CLI_DEFAULTS.PROGRAM_NAME}: removed ${name} (id ${event.id})\n`);
  const moved = events.filter((candidate) => candidate.id > event.id);
  if (moved.length === 0) return;
  process.stdout.write(
    `${CLI_DEFAULTS.PROGRAM_NAME}: ${describeMoved(moved.map((candidate) => candidate.name))} moved down one id\n`,
  );
}

/** Every name when there are few; the ends of the range when listing them all would bury the point. */
function describeMoved(names: readonly string[]): string {
  const first = names[0];
  const last = names.at(-1);
  if (names.length <= 3 || first === undefined || last === undefined) return names.join(', ');
  return `${String(names.length)} events, ${first} to ${last},`;
}

export { removeEvent };
