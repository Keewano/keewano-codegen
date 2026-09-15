import type { EmitTarget } from '../../emitters/types/emit';

/**
 * Settings read from `keewano.codegen.json`. Every field is optional;
 * an absent field falls back to the CLI default. Paths are already
 * resolved to absolute form against the config file's directory.
 *
 * input - the definitions file.
 * code - directory the generated file goes in.
 * asset - directory the definition-set asset goes in, for the target
 *   that emits one.
 * target - SDK the generated module is emitted for.
 * json - also write the readable manifest next to the generated file.
 */
interface CodegenConfig {
  input?: string;
  code?: string;
  asset?: string;
  target?: EmitTarget;
  json?: boolean;
}

/**
 * Arguments of `loadConfig`.
 *
 * path - absolute path of the config file to read.
 */
interface LoadConfigArgs {
  path: string;
}

/**
 * Arguments of `resolveConfigPath`.
 *
 * path - the config file; relative values resolve against its directory.
 * key - which setting is being resolved, for error messages.
 * value - the raw JSON value of that setting.
 */
interface ResolveConfigPathArgs {
  path: string;
  key: string;
  value: unknown;
}

export type { CodegenConfig, LoadConfigArgs, ResolveConfigPathArgs };
