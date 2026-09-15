/**
 * What a command line means. The tokens arrive already split; this
 * turns them into the arguments one command runs with, resolving the
 * definitions file exactly as the generate path resolves it so a
 * project configured once is configured for every command.
 *
 * A parser of its own rather than the generate path's: that one resolves
 * a code directory, an asset and a target, none of which a command that
 * only edits definitions has. Feeding it here would make `add` fail over
 * a missing `--code` it never needed.
 */

import type {
  CommandArgs,
  DemandOwnFlagArgs,
  ParseCommandArgsArgs,
  ResolveInputArgs,
} from './types/commandArgs';
import type { CustomEventTypeValue } from '../events/customEventType';

import { resolve as resolvePath } from 'node:path';

import {
  CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE,
  CUSTOM_EVENT_TYPE_BY_DATA_TYPE_NAME,
  isCustomEventDataTypeName,
} from '../events/customEventType';
import { ParseError } from '../shared/errors';

import { FLAGS_BY_COMMAND } from './commandFlags';
import { splitTokens } from './commandTokens';
import { CLI_DEFAULTS } from './defaults';
import { loadConfig } from './settings';

const TYPE_NAMES: readonly string[] = Object.values(CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE);

function parseCommandArgs({ command, argv }: ParseCommandArgsArgs): CommandArgs {
  const { name, values } = splitTokens({ command, argv });
  const typedConfig = values.get('--config');
  const configPath = resolvePath(process.cwd(), typedConfig ?? CLI_DEFAULTS.CONFIG_FILE_NAME);
  /**
   * A file named by `--config` must exist, exactly as on the generate
   * path: a typo in its name would otherwise fall back to the default
   * and edit a definitions file nobody asked for.
   */
  const config = loadConfig({ path: configPath });
  if (typedConfig !== undefined && config === undefined) {
    throw new ParseError(`parse: --config ${configPath} not found`);
  }
  const common = {
    name,
    input: resolveInput({ typed: values.get('--input'), configured: config?.input }),
  };
  if (command === 'remove') return { ...common, command };
  const own = demandOwnFlag({ command, values });
  if (command === 'edit') return { ...common, command, rename: own };
  return { ...common, command, type: typeFromName(own) };
}

/**
 * The flag the command cannot run without. The parameter is narrowed to
 * the commands that declare one, so the table answers with a name rather
 * than with a maybe - the case of a command having none is ruled out by
 * the caller returning before this point, not by a check here.
 */
function demandOwnFlag({ command, values }: DemandOwnFlagArgs): string {
  const flag = FLAGS_BY_COMMAND[command].required;
  const value = values.get(flag);
  if (value === undefined) {
    throw new ParseError(`parse: ${command} requires ${flag}`);
  }
  return value;
}

/** The tag behind the name the user typed: `--type` speaks the vocabulary the file does. */
function typeFromName(value: string): CustomEventTypeValue {
  if (!isCustomEventDataTypeName(value)) {
    throw new ParseError(`parse: --type must be one of ${TYPE_NAMES.join(', ')}`);
  }
  return CUSTOM_EVENT_TYPE_BY_DATA_TYPE_NAME[value];
}

function resolveInput({ typed, configured }: ResolveInputArgs): string {
  if (typed !== undefined) return resolvePath(process.cwd(), typed);
  return configured ?? resolvePath(process.cwd(), CLI_DEFAULTS.INPUT_FILE);
}

export { parseCommandArgs };
