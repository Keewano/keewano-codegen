/**
 * The command line split into its two kinds of token: the one event name
 * and the `--flag value` pairs. Nothing here interprets a value - what a
 * type name or an id means is the assembler's business, so a flag can be
 * added to the table without this file changing at all.
 */

import type { OnlyPositionalArgs, ParseCommandArgsArgs, SplitTokens } from './types/commandArgs';

import { ParseError } from '../shared/errors';

import { FLAGS_BY_COMMAND, SHARED_FLAGS } from './commandFlags';

/** Unknown flags are refused where they were typed, rather than ignored. */
function splitTokens({ command, argv }: ParseCommandArgsArgs): SplitTokens {
  const spec = FLAGS_BY_COMMAND[command];
  const own = spec.required === undefined ? [] : [spec.required];
  const allowed = new Set([...own, ...spec.optional, ...SHARED_FLAGS]);
  const values = new Map<string, string>();
  const positional: string[] = [];
  let index = 0;
  while (index < argv.length) {
    const token = argv[index] ?? '';
    if (!token.startsWith('-')) {
      positional.push(token);
      index += 1;
      continue;
    }
    if (!allowed.has(token)) {
      throw new ParseError(`parse: ${command} does not take "${token}"`);
    }
    const next = argv[index + 1];
    /** The shape an unset shell variable takes; it must not pass as a value. */
    if (next === undefined || next.startsWith('-') || next.trim() === '') {
      throw new ParseError(`parse: ${token} requires a value`);
    }
    values.set(token, next);
    index += 2;
  }
  return { name: onlyPositional({ command, positional }), values };
}

function onlyPositional({ command, positional }: OnlyPositionalArgs): string {
  const name = positional[0];
  if (name === undefined) throw new ParseError(`parse: ${command} needs an event name`);
  if (positional.length > 1) throw new ParseError(`parse: ${command} takes one event name`);
  return name;
}

export { splitTokens };
