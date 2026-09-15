/**
 * Resolve what the CLI runs with. Three layers, later wins: built-in
 * defaults, then the project config file (`keewano.codegen.json` in
 * cwd, or `--config <file>`), then the explicit flags. A flag that was
 * typed always beats the file, so a one-off `--target web` works
 * against a config that says `expo` and `--no-json` switches the
 * manifest off for one run.
 *
 * The caller names directories and the generator names files. A target
 * decides what its generated file is called - the SDK that imports it
 * looks for that name - so `--code` is the directory it goes in, and
 * `--asset`, for the one target whose SDK reads the set from a file at
 * launch, the directory that file goes in.
 */

import type { CliArgs, RefuseFileNameArgs, ResolvePathArgs } from './types/argv';

import { extname, resolve as resolvePath } from 'node:path';

import {
  DEFAULT_TARGET,
  TARGET_NAMES,
  assetFileNameFor,
  generatedFileNameFor,
} from '../emitters/registry';
import { ParseError } from '../shared/errors';

import { CLI_DEFAULTS } from './defaults';
import { collectFlags } from './flags';
import { loadConfig } from './settings';

/**
 * Every extension the generator gives a file it writes, across all
 * targets: the shapes the old habit of naming the file takes, whichever
 * target the habit was formed on.
 */
const GENERATED_EXTENSIONS: ReadonlySet<string> = new Set(
  TARGET_NAMES.flatMap((target) => [generatedFileNameFor(target), assetFileNameFor(target)])
    .filter((name): name is string => name !== undefined)
    .map((name) => extname(name).toLowerCase()),
);

function parseArgv(argv: readonly string[]): CliArgs {
  const flags = collectFlags(argv);
  const cwd = process.cwd();
  const configPath = flags.config ?? resolvePath(cwd, CLI_DEFAULTS.CONFIG_FILE_NAME);
  /**
   * `--help` / `--version` never touch the settings file: a broken file
   * must not stop the user from reading the usage.
   */
  const isMetaRun = flags.help || flags.version;
  const config = isMetaRun ? undefined : loadConfig({ path: configPath });
  /**
   * The default file may be absent (most projects have none); a file
   * named with `--config` must exist, or a typo in its name would
   * silently generate with the defaults.
   */
  if (!isMetaRun && config === undefined && flags.config !== undefined) {
    throw new ParseError(`parse: --config ${configPath} not found`);
  }
  const input = flags.input ?? config?.input ?? resolvePath(cwd, CLI_DEFAULTS.INPUT_FILE);
  const target = flags.target ?? config?.target ?? DEFAULT_TARGET;
  const layers = { target, flags, config, configPath };
  /**
   * A meta run prints and exits without writing, so where it would have
   * written is not its business - and refusing `--help` over a missing
   * directory withholds the one page that says which flag names it.
   */
  return {
    input,
    output: isMetaRun ? '' : resolveOutputPath(layers),
    target,
    asset: isMetaRun ? undefined : resolveAssetPath(layers),
    json: flags.json ?? config?.json ?? false,
    watch: flags.watch,
    help: flags.help,
    version: flags.version,
  };
}

/**
 * The generated file: the directory the caller named, plus the name the
 * target gives it. Required rather than defaulted - a source set is
 * something only the caller can point at, and a default that lands the
 * file where nothing builds it reports success doing so.
 */
function resolveOutputPath({ target, flags, config, configPath }: ResolvePathArgs): string {
  const fileName = generatedFileNameFor(target);
  const directory = flags.code ?? config?.code;
  if (directory === undefined) {
    throw new ParseError(`parse: --code <dir> is required; the file is named ${fileName} there`);
  }
  const source = flags.code === undefined ? `"code" in ${configPath}` : '--code';
  refuseFileName({ source, directory, fileName });
  return resolvePath(directory, fileName);
}

/**
 * The definition-set asset, for the target whose SDK reads one. Required
 * there for the same reason the code directory is; refused elsewhere
 * rather than ignored, because a typed flag that does nothing hides a
 * mistake. A committed settings file is ambient - one repository can
 * generate for several targets - so its value applies only where an
 * asset exists.
 */
function resolveAssetPath({
  target,
  flags,
  config,
  configPath,
}: ResolvePathArgs): string | undefined {
  const fileName = assetFileNameFor(target);
  if (fileName === undefined) {
    if (flags.asset !== undefined) {
      throw new ParseError(`parse: the ${target} target emits no asset`);
    }
    return undefined;
  }
  const directory = flags.asset ?? config?.asset;
  if (directory === undefined) {
    throw new ParseError(
      `parse: the ${target} target needs --asset <dir>; the file is named ${fileName} there`,
    );
  }
  const source = flags.asset === undefined ? `"asset" in ${configPath}` : '--asset';
  refuseFileName({ source, directory, fileName });
  return resolvePath(directory, fileName);
}

/**
 * The habit every earlier invocation built: a path ending in the file.
 * Taken as a directory it would create a folder called `Foo.kt` and put
 * the file inside, and the build that looked for `Foo.kt` would find a
 * directory. The habit is recognised by its extension - one the
 * generator gives some file it writes, whichever target formed the habit
 * - and nothing wider: a directory called `v1.2` is a directory.
 */
function refuseFileName({ source, directory, fileName }: RefuseFileNameArgs): void {
  if (!GENERATED_EXTENSIONS.has(extname(directory).toLowerCase())) return;
  throw new ParseError(
    `parse: ${source} takes a directory; the file in it is named ${fileName} by the generator`,
  );
}

export { parseArgv };
