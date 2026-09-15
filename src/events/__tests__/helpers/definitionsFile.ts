/**
 * Event fixtures: a parsed event in memory, a definitions file on disk,
 * and a file of the old per-event layout, so every test stays in
 * lock-step when `ParsedEvent` or the on-disk shape evolves.
 */

import type { ParsedEvent } from '../../types/event';
import type {
  MakeEventArgs,
  WriteDefinitionsFileArgs,
  WriteLegacyEventFileArgs,
  WriteRawDefinitionsFileArgs,
} from '../types/definitionsFile';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { FIRST_CUSTOM_EVENT_ID } from '../../customEventType';
import { DEFINITIONS_FILE_NAME, definitionEntry } from '../../definitionsDocument';

function definitionsFileIn(directory: string): string {
  return join(directory, DEFINITIONS_FILE_NAME);
}

function makeEvent({ name, type, indexOffset }: MakeEventArgs): ParsedEvent {
  return {
    name,
    type,
    id: FIRST_CUSTOM_EVENT_ID + indexOffset,
  };
}

/** A well-formed definitions file: `{ "events": [ { "eventName", "eventValueType" } ] }`, in the order given. */
function writeDefinitionsFile({ file, events }: WriteDefinitionsFileArgs): void {
  writeRawDefinitionsFile({
    file,
    body: { events: events.map((entry) => definitionEntry(entry)) },
  });
}

/** Any JSON body, for the rejection tests. */
function writeRawDefinitionsFile({ file, body }: WriteRawDefinitionsFileArgs): void {
  writeFileSync(file, JSON.stringify(body), 'utf8');
}

/** One file of the old per-event layout, under `<name>.json`. */
function writeLegacyEventFile({ directory, name, body }: WriteLegacyEventFileArgs): void {
  writeFileSync(join(directory, `${name}.json`), JSON.stringify(body), 'utf8');
}

export {
  DEFINITIONS_FILE_NAME,
  definitionsFileIn,
  makeEvent,
  writeDefinitionsFile,
  writeLegacyEventFile,
  writeRawDefinitionsFile,
};
