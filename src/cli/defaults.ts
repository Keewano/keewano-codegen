/**
 * Boot-time defaults for the user-facing flags, as one namespaced
 * `as const` object so consumers say `CLI_DEFAULTS.INPUT_FILE`.
 *
 * PROGRAM_NAME - what the CLI calls itself in its own output.
 * INPUT_FILE - default `--input`, the definitions file (relative to cwd).
 * CONFIG_FILE_NAME - project settings file looked up in cwd.
 * MANIFEST_FILE_NAME - the optional readable artifact written by --json.
 */

import { DEFINITIONS_FILE_NAME } from '../events/definitionsDocument';

const CLI_DEFAULTS = {
  PROGRAM_NAME: 'keewano-codegen',
  INPUT_FILE: DEFINITIONS_FILE_NAME,
  CONFIG_FILE_NAME: 'keewano.codegen.json',
  MANIFEST_FILE_NAME: 'keewano-events.json',
} as const;

export { CLI_DEFAULTS };
