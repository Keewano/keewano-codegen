/**
 * The help text. It changes whenever a flag or a command does, and for
 * no other reason, so it lives apart from the defaults and the exit
 * codes.
 */

import type { EmitTarget } from '../emitters/types/emit';
import type { CustomEventTypeValue } from '../events/customEventType';

import {
  DEFAULT_TARGET,
  TARGET_NAMES,
  assetFileNameFor,
  generatedFileNameFor,
} from '../emitters/registry';
import {
  CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE,
  CUSTOM_EVENT_TYPE_NAME_BY_TYPE,
  FIRST_CUSTOM_EVENT_ID,
} from '../events/customEventType';

import { CLI_DEFAULTS } from './defaults';

/**
 * Prose that names targets goes stale the moment one is added; the
 * registry answers instead. Joined as a sentence rather than with a
 * separator, because a third target turned "kotlin and swift" into
 * "kotlin and swift and python" the day one was added.
 */
const listTargets = (predicate: (target: EmitTarget) => boolean): string => {
  const names = TARGET_NAMES.filter(predicate);
  const last = names.at(-1);
  if (last === undefined) return '';
  if (names.length === 1) return last;
  return `${names.slice(0, -1).join(', ')} and ${last}`;
};

const TARGETS_WITH_ASSET = listTargets((target) => assetFileNameFor(target) !== undefined);

/** `--target` values for the usage text, default marked, in registry order. */
const TARGET_LIST = TARGET_NAMES.map((name) =>
  name === DEFAULT_TARGET ? `${name} (default)` : name,
).join(', ');

/** What each target writes, read off the registry so a target added there is listed here. */
const GENERATED_FILE_LIST = TARGET_NAMES.map((target) => {
  const asset = assetFileNameFor(target);
  const files =
    asset === undefined
      ? generatedFileNameFor(target)
      : `${generatedFileNameFor(target)}, and ${asset} under --asset`;
  return `  ${target.padEnd(16)}${files}`;
}).join('\n');

/**
 * The payload types, read off the same tables the emitters use. The wire
 * name leads: it is what the file's `eventValueType` and `add --type`
 * both take. The name in parentheses is the one the generated file's
 * header prints beside each event, so a reader can match the two.
 */
const EVENT_TYPE_LIST = Object.entries(CUSTOM_EVENT_TYPE_NAME_BY_TYPE)
  .map(([tag, name]) => {
    const wire = CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE[Number(tag) as CustomEventTypeValue];
    return `  ${wire.padEnd(16)}${name}`;
  })
  .join('\n');

const USAGE = [
  'Usage: keewano-codegen --target <sdk> --code <dir> [--asset <dir>] [options]',
  '       keewano-codegen add <Name> --type <type> [--input <file>] [--config <file>]',
  '       keewano-codegen edit <Name> --rename <Name> [--input <file>] [--config <file>]',
  '       keewano-codegen remove <Name> [--input <file>] [--config <file>]',
  '',
  'Commands, for editing definitions instead of generating from them:',
  '  add               Declare an event: appends it to the file, so it takes the next id',
  '  edit              Rename an event, keeping its position, id and payload type',
  '  remove            Delete an event that is not in use',
  '',
  'Options:',
  `  --input <file>    The definitions file (default: ./${CLI_DEFAULTS.INPUT_FILE})`,
  `  --target <sdk>    Target SDK: ${TARGET_LIST}`,
  "  --code <dir>      Directory the generated file is written into; the file name is the target's",
  `  --asset <dir>     Directory the definition-set asset is written into; ${TARGETS_WITH_ASSET} only`,
  '  --watch           Watch the definitions file and re-emit on save',
  `  --json            Also write ${CLI_DEFAULTS.MANIFEST_FILE_NAME} (ids, names, types, base64 map) next to the generated file`,
  '  --no-json         Do not write it, even if the settings file says so',
  `  --config <file>   Settings file (default: ./${CLI_DEFAULTS.CONFIG_FILE_NAME}, may be absent); flags override it`,
  '  --help            Print this help and exit',
  '  --version         Print package version and exit',
  '',
  'The definitions file holds { "events": [ { "eventName": "Name", "eventValueType": "<type>" } ] }.',
  `An event's id is ${String(FIRST_CUSTOM_EVENT_ID)} plus its position, so add at the end and never reorder.`,
  '',
  'Generated file names, by target:',
  GENERATED_FILE_LIST,
  '',
  'Event types, as `eventValueType` in the file and `add --type` on the command line:',
  EVENT_TYPE_LIST,
].join('\n');

export { USAGE };
