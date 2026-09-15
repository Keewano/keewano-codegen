/**
 * What the command line said, and only that: the flag syntax. Which
 * value wins when a flag, the settings file and a default disagree is
 * argv.ts's business.
 */

import type { ApplyFlagArgs, CliFlags, ReadValueArgArgs } from './types/flags';

import { resolve as resolvePath } from 'node:path';

import { TARGET_NAMES, isEmitTarget } from '../emitters/registry';
import { ParseError } from '../shared/errors';

/** Flags that take a path value, and the field each one fills. */
const PATH_FLAG_FIELD_BY_FLAG = {
  '--input': 'input',
  '--code': 'code',
  '--asset': 'asset',
  '--config': 'config',
} as const;

type PathFlag = keyof typeof PATH_FLAG_FIELD_BY_FLAG;

/** Only what was typed; absent fields stay `undefined` so the next layer fills them. */
function collectFlags(argv: readonly string[]): CliFlags {
  const flags: CliFlags = { watch: false, help: false, version: false };
  let index = 0;
  while (index < argv.length) {
    index += applyFlag({ flags, token: argv[index], argv, index });
  }
  return flags;
}

function isPathFlag(token: string | undefined): token is PathFlag {
  return token !== undefined && Object.hasOwn(PATH_FLAG_FIELD_BY_FLAG, token);
}

/**
 * Apply one argv token (and any value it consumes) to `flags`. Returns
 * the slot count the token consumed (1 for boolean flags, 2 for value
 * flags).
 */
function applyFlag({ flags, token, argv, index }: ApplyFlagArgs): number {
  if (isPathFlag(token)) {
    const value = readValueArg({ name: token, argv, index });
    flags[PATH_FLAG_FIELD_BY_FLAG[token]] = resolvePath(process.cwd(), value);
    return 2;
  }
  switch (token) {
    case '--target': {
      const value = readValueArg({ name: '--target', argv, index });
      if (!isEmitTarget(value)) {
        throw new ParseError(`parse: --target must be one of ${TARGET_NAMES.join(', ')}`);
      }
      flags.target = value;
      return 2;
    }
    /**
     * The flag every earlier invocation carried. Refused by name rather
     * than as unknown, because the reader needs the flag that replaced
     * it and why the file name is no longer theirs to choose.
     */
    case '--output':
      throw new ParseError(
        "parse: --output was replaced by --code <dir>; the file name is the generator's",
      );
    case '--json':
      flags.json = true;
      return 1;
    case '--no-json':
      flags.json = false;
      return 1;
    case '--watch':
      flags.watch = true;
      return 1;
    case '--help':
    case '-h':
      flags.help = true;
      return 1;
    case '--version':
    case '-v':
      flags.version = true;
      return 1;
    default:
      throw new ParseError(`parse: unknown option "${String(token)}"`);
  }
}

/**
 * A blank value is the shape an unset shell variable takes
 * (`--input "$EVENTS_FILE"`): it would resolve to the current directory
 * and generate an empty set over a committed file, reporting success.
 */
function readValueArg({ name, argv, index }: ReadValueArgArgs): string {
  const next = argv[index + 1];
  if (next === undefined || next.startsWith('-') || next.trim() === '') {
    throw new ParseError(`parse: ${name} requires a value`);
  }
  return next;
}

export { collectFlags };
