import type { EmitTarget } from '../../emitters/types/emit';

/**
 * What the flags said, and only that: a field stays `undefined` when its
 * flag was not typed, so the settings file and the defaults can fill it
 * in that order. The three meta flags are always known.
 *
 * input - the definitions file, resolved to an absolute path.
 * code - the directory the generated file goes in, resolved.
 * asset - the directory the definition-set asset goes in, resolved.
 * config - the settings file, resolved.
 * target - the `--target` value.
 * json - `true` for `--json`, `false` for `--no-json`.
 * watch / help / version - the boolean switches.
 */
interface CliFlags {
  input?: string;
  code?: string;
  asset?: string;
  config?: string;
  target?: EmitTarget;
  json?: boolean;
  watch: boolean;
  help: boolean;
  version: boolean;
}

/**
 * Per-token consumer state for the inner argv loop.
 *
 * flags - the in-flight result object being populated.
 * token - the current argv token under inspection.
 * argv - the full argv array (for value-flag lookahead).
 * index - position of `token` within `argv`.
 */
interface ApplyFlagArgs {
  flags: CliFlags;
  token: string | undefined;
  argv: readonly string[];
  index: number;
}

/**
 * Helper input for reading a `--flag <value>` argv pair.
 *
 * name - the flag whose value is being read (for error messages).
 * argv - the full argv array.
 * index - position of the flag; the value is the next slot.
 */
interface ReadValueArgArgs {
  name: string;
  argv: readonly string[];
  index: number;
}

export type { ApplyFlagArgs, CliFlags, ReadValueArgArgs };
