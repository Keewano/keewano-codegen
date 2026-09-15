/**
 * The definitions file as this tool writes it: its default name, the
 * shape of one entry, and the one layout every write uses. Declared once
 * so the commands, the conversion of the old layout and the tests all
 * produce the same bytes - a second rendering would reformat the whole
 * file the first time the other one touched it.
 *
 * The layout is the tool's, not the file's: a file laid out by hand comes
 * back reformatted the first time a command writes it, and identical from
 * then on, which is what keeps the commit of an `add` to the one entry it
 * added.
 */

import type { DefinitionEntryArgs } from './types/definitionsDocument';
import type { RawEventDefinition, RawEventDefinitions } from './types/event';

import { CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE } from './customEventType';

/** What `--input` reads when it is not given, relative to the working directory. */
const DEFINITIONS_FILE_NAME = 'keewano.events.json';

function definitionEntry({ name, type }: DefinitionEntryArgs): RawEventDefinition {
  return { eventName: name, eventValueType: CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE[type] };
}

function renderDefinitions(definitions: RawEventDefinitions): string {
  return `${JSON.stringify(definitions, undefined, 2)}\n`;
}

export { DEFINITIONS_FILE_NAME, definitionEntry, renderDefinitions };
