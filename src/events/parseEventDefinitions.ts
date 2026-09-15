/**
 * Read and validate the definitions file into a `ParsedEvent[]` in
 * declaration order. The file is JSON checked against
 * `schemas/keewano-events.schema.json`; every entry's id is the first
 * reserved id plus its position, so the same file yields the same bytes
 * on every machine, and the order in the file is the order on the wire.
 *
 * Errors are thrown as typed `ParseError` / `IoError` instances so a
 * caller separates them by type, never by message prefix.
 */

import type { ParsedEvent, RawEventDefinitions } from './types/event';
import type {
  EnforceEventCountCapArgs,
  EventsOfArgs,
  ParseEventDefinitionsArgs,
  ParseResult,
  ReadDocumentArgs,
} from './types/parseEventDefinitions';

import Ajv2020 from 'ajv/dist/2020';
import { basename } from 'node:path';

import schema from '../../schemas/keewano-events.schema.json';
import { IoError, ParseError } from '../shared/errors';
import { readJsonFile } from '../shared/readJsonFile';

import {
  CUSTOM_EVENT_TYPE_BY_DATA_TYPE_NAME,
  FIRST_CUSTOM_EVENT_ID,
  MAX_CUSTOM_EVENT_COUNT,
} from './customEventType';
import { isReservedEventName } from './eventName';
import { refuseLegacyDirectory } from './legacyDirectory';

/**
 * `Ajv2020` ships the draft-2020-12 meta-schema the file declares; the
 * default `Ajv` export would refuse to compile it.
 */
const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile<RawEventDefinitions>(schema);

/**
 * What a rejected document is when it is not a definitions file at all:
 * the two files this tool itself writes beside one, and the shape it
 * used to read. Each is told apart by keys only it carries - all of them,
 * so a definitions file with one stray key of the same name is reported
 * as what it is, a document with an unknown property - and named,
 * because the schema's own complaint about a missing `events` key would
 * send the reader hunting for one in a file they never wrote.
 */
const OTHER_SHAPES: readonly { keys: readonly string[]; reason: string }[] = [
  {
    keys: ['schemaVersion', 'gzipDataBase64'],
    reason: 'the generated manifest, not the definitions file',
  },
  {
    keys: ['gzipBase64'],
    reason: 'the generated definition-set asset, not the definitions file',
  },
  {
    keys: ['n', 't'],
    reason:
      'old per-event shape; one file holds { "events": [ { "eventName", "eventValueType" } ] }',
  },
];

function parseEventDefinitions({ inputFile }: ParseEventDefinitionsArgs): ParseResult {
  const label = `parse: ${basename(inputFile)}`;
  refuseLegacyDirectory({ inputFile, label });
  const definitions = readDocument({ inputFile, label });
  return { definitions, events: eventsOf({ definitions, label }) };
}

/**
 * The events a validated document declares, with the rules the schema
 * cannot state: no reserved name, no name twice, no more than the wire
 * can number.
 */
function eventsOf({ definitions, label }: EventsOfArgs): ParsedEvent[] {
  enforceEventCountCap({ count: definitions.events.length, label });
  const seen = new Set<string>();
  return definitions.events.map((entry, index) => {
    if (isReservedEventName(entry.eventName)) {
      throw new ParseError(
        `${label}: "${entry.eventName}" is a reserved name (built-in report method)`,
      );
    }
    if (seen.has(entry.eventName)) {
      throw new ParseError(`${label}: duplicate event name "${entry.eventName}"`);
    }
    seen.add(entry.eventName);
    return {
      name: entry.eventName,
      type: CUSTOM_EVENT_TYPE_BY_DATA_TYPE_NAME[entry.eventValueType],
      id: FIRST_CUSTOM_EVENT_ID + index,
    };
  });
}

function readDocument({ inputFile, label }: ReadDocumentArgs): RawEventDefinitions {
  const json = readJsonFile({ path: inputFile, label });
  if (json === undefined) {
    throw new IoError(`${label}: definitions file not found: ${inputFile}`);
  }
  if (validate(json)) return json;
  const other = otherShapeOf(json);
  if (other !== undefined) throw new ParseError(`${label}: ${other}`);
  const reason = ajv.errorsText(validate.errors, { dataVar: 'definitions', separator: '; ' });
  throw new ParseError(`${label}: ${reason}`);
}

function otherShapeOf(json: unknown): string | undefined {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return undefined;
  return OTHER_SHAPES.find((shape) => shape.keys.every((key) => Object.hasOwn(json, key)))?.reason;
}

function enforceEventCountCap({ count, label }: EnforceEventCountCapArgs): void {
  if (count > MAX_CUSTOM_EVENT_COUNT) {
    throw new ParseError(
      `${label}: too many custom events (${count}); maximum supported is ${MAX_CUSTOM_EVENT_COUNT}`,
    );
  }
}

export { parseEventDefinitions };
