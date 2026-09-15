/**
 * The commands that change the definitions file rather than generate
 * from it, and the one place that decides a run is one of them.
 *
 * Recognised from the first token only, and only when it is a bare word.
 * A run that starts with a flag is what every existing invocation looks
 * like, so it reaches the generate path untouched and nothing that
 * worked before is read as a command now.
 */

import type { CommandName, RunCommandArgs } from './types/commandArgs';

import { addEvent } from './addEvent';
import { parseCommandArgs } from './commandArgs';
import { editEvent } from './editEvent';
import { removeEvent } from './removeEvent';

const COMMAND_NAMES = new Set<string>(['add', 'edit', 'remove']);

/** The command this argv runs, or nothing when it is a generate run. */
function commandNameOf(argv: readonly string[]): CommandName | undefined {
  const first = argv[0];
  if (first === undefined || !COMMAND_NAMES.has(first)) return undefined;
  return first as CommandName;
}

/**
 * A first token that reads as a command but names none. Without this the
 * generate path answers, and it can only see flags, so a mistyped command
 * came back as an unknown option - which sends the reader looking for a
 * flag they never typed.
 */
function unknownCommandIn(argv: readonly string[]): string | undefined {
  const first = argv[0];
  if (first === undefined || first === '' || first.startsWith('-')) return undefined;
  return COMMAND_NAMES.has(first) ? undefined : first;
}

/**
 * The commands take no flags of the generate path's, so `--help` would be
 * refused as one of those - and asking a command how to use it is the one
 * moment a refusal helps least.
 */
function asksForHelp(argv: readonly string[]): boolean {
  return argv.slice(1).some((token) => token === '--help' || token === '-h');
}

/**
 * Throws on every rejection rather than returning an exit code: the
 * caller already maps a typed error onto the code contract, and a
 * command that returned one too would give the same failure two spellings.
 */
function runCommand({ command, argv }: RunCommandArgs): void {
  const args = parseCommandArgs({ command, argv: argv.slice(1) });
  const { name, input } = args;
  if (args.command === 'add') {
    addEvent({ name, type: args.type, input });
    return;
  }
  if (args.command === 'edit') {
    editEvent({ name, rename: args.rename, input });
    return;
  }
  removeEvent({ name, input });
}

export { asksForHelp, commandNameOf, runCommand, unknownCommandIn };
