import type { CliFlags } from './flags';
import type { CodegenConfig } from './settings';
import type { EmitTarget } from '../../emitters/types/emit';

/**
 * What the CLI runs with, after flags, the settings file and the
 * defaults were resolved in that order.
 *
 * input - resolved absolute path of the definitions file.
 * output - resolved absolute path of the generated file: the directory
 *   `--code` named, plus the name the target gives the file.
 * asset - resolved path of the definition-set asset, present only for
 *   the target that emits one: the directory `--asset` named, plus the
 *   name the SDK looks the file up under.
 * target - SDK the generated module is emitted for.
 * watch - when true, the CLI stays in foreground watching `input` and
 *   re-emits on debounced change.
 * json - also write the readable manifest next to `output`.
 * help / version - meta flags that short-circuit the run.
 */
interface CliArgs {
  input: string;
  output: string;
  asset?: string | undefined;
  target: EmitTarget;
  watch: boolean;
  json: boolean;
  help: boolean;
  version: boolean;
}

/**
 * Arguments of `resolveOutputPath` and `resolveAssetPath`.
 *
 * target - the resolved target, which owns the file names.
 * flags / config - the explicit layers; a flag beats the file.
 * configPath - the settings file the config layer was read from, so a
 *   refusal can name the key there rather than a flag nobody typed.
 */
interface ResolvePathArgs {
  target: EmitTarget;
  flags: CliFlags;
  config: CodegenConfig | undefined;
  configPath: string;
}

/**
 * Arguments of `refuseFileName`.
 *
 * source - where the directory came from, as the message names it: the
 *   flag, or the key in the settings file.
 * directory - the value as typed.
 * fileName - the file the generator would write there.
 */
interface RefuseFileNameArgs {
  source: string;
  directory: string;
  fileName: string;
}

export type { CliArgs, RefuseFileNameArgs, ResolvePathArgs };
