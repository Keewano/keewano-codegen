/**
 * Optional project config, `keewano.codegen.json` in the working
 * directory, so a team keeps its generation settings in one committed
 * file instead of remembering flags. Explicit CLI flags win over the
 * file, the file wins over the built-in defaults.
 *
 * Only the keys below are read; anything else is rejected so a typo
 * (`taget`) fails loudly instead of silently falling back to the
 * default target. Paths are resolved against the config file's own
 * directory, which is what a committed file means by a relative path.
 */

import type { CodegenConfig, LoadConfigArgs, ResolveConfigPathArgs } from './types/settings';

import { dirname, resolve as resolvePath } from 'node:path';

import { isEmitTarget } from '../emitters/registry';
import { ParseError } from '../shared/errors';
import { readJsonFile } from '../shared/readJsonFile';

/**
 * Read and validate the config at `path`. `undefined` when the file
 * does not exist - the only silent outcome; a present-but-broken file
 * is a `ParseError` (or an `IoError` when it cannot be read), because
 * the user clearly meant to configure something.
 */
function loadConfig({ path }: LoadConfigArgs): CodegenConfig | undefined {
  const json = readJsonFile({ path, label: `config: ${path}` });
  if (json === undefined) return undefined;
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new ParseError(`config: ${path}: expected a JSON object`);
  }
  const config: CodegenConfig = {};
  for (const [key, value] of Object.entries(json)) {
    switch (key) {
      case 'input':
      case 'code':
      case 'asset':
        config[key] = resolveConfigPath({ path, key, value });
        break;
      case 'target':
        if (typeof value !== 'string' || !isEmitTarget(value)) {
          throw new ParseError(`config: ${path}: "target" is not a supported target`);
        }
        config.target = value;
        break;
      case 'json':
        if (typeof value !== 'boolean') {
          throw new ParseError(`config: ${path}: "json" must be true or false`);
        }
        config.json = value;
        break;
      /** The key every earlier settings file carried; named so the reader finds its replacement. */
      case 'output':
        throw new ParseError(
          `config: ${path}: "output" was replaced by "code", the directory the generated file goes in`,
        );
      default:
        throw new ParseError(`config: ${path}: unknown key "${key}"`);
    }
  }
  return config;
}

/** A relative path in the file means relative to the file, not to cwd. */
function resolveConfigPath({ path, key, value }: ResolveConfigPathArgs): string {
  if (typeof value !== 'string' || value === '') {
    throw new ParseError(`config: ${path}: "${key}" must be a non-empty string`);
  }
  return resolvePath(dirname(path), value);
}

export { loadConfig };
