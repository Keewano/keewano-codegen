/**
 * Which flags each command accepts, in one table, because two files ask
 * different questions of it: the token scanner needs the whole set to
 * refuse anything else, and the assembler needs the one flag a command
 * cannot run without.
 *
 * Written `as const` so the entries keep their literal types. That is
 * what lets the assembler read a required flag straight off the table
 * and get a definite string for the commands that declare one, instead
 * of a maybe-absent value it would have to check at runtime for a case
 * the table already rules out.
 */

import type { CommandFlagSpec, CommandName } from './types/commandArgs';

/** What each command takes beyond the two below. */
const FLAGS_BY_COMMAND = {
  add: { required: '--type', optional: [] },
  edit: { required: '--rename', optional: [] },
  remove: { required: undefined, optional: [] },
} as const satisfies Readonly<Record<CommandName, CommandFlagSpec>>;

/** Accepted by every command, and resolved exactly as the generate path resolves them. */
const SHARED_FLAGS: readonly string[] = ['--input', '--config'];

export { FLAGS_BY_COMMAND, SHARED_FLAGS };
