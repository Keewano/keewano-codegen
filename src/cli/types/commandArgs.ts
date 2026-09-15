import type { CustomEventTypeValue } from '../../events/customEventType';

/** The commands that act on the definitions file instead of generating from it. */
type CommandName = 'add' | 'edit' | 'remove';

/**
 * The flags one command accepts beyond the two every command takes.
 *
 * required - the flag the command cannot run without, or `undefined` for
 *   a command whose event name says everything, which is what `remove`
 *   is. Spelled out rather than left off, so every command answers the
 *   question and the answer can be read straight off the table.
 * optional - flags the command accepts and can do without.
 */
interface CommandFlagSpec {
  required: string | undefined;
  optional: readonly string[];
}

/**
 * What every command line resolves to, whichever command it was, after
 * the layering the generate path uses: a typed flag beats the settings
 * file, which beats the default.
 *
 * name - the event the command acts on, taken from the single positional
 *   argument. Not validated here; the command owns that.
 * input - the resolved definitions file.
 */
interface CommonCommandArgs {
  name: string;
  input: string;
}

/**
 * A parsed `add`. `type` is the payload tag `--type` named.
 *
 * A union member rather than optional fields on one shape: the flag a
 * command requires is then a promise the type keeps, and the command
 * runner needs no runtime check for a value the parser already demanded.
 */
interface AddCommandArgs extends CommonCommandArgs {
  command: 'add';
  type: CustomEventTypeValue;
}

/** A parsed `edit`. `rename` is the new name `--rename` named. */
interface EditCommandArgs extends CommonCommandArgs {
  command: 'edit';
  rename: string;
}

/** A parsed `remove`. The event name is the whole instruction. */
interface RemoveCommandArgs extends CommonCommandArgs {
  command: 'remove';
}

type CommandArgs = AddCommandArgs | EditCommandArgs | RemoveCommandArgs;

/**
 * Arguments of `parseCommandArgs`.
 *
 * command - which command the tokens belong to, so the flags it requires
 *   are the ones demanded and the flags it does not accept are refused.
 * argv - the tokens after the command word.
 */
interface ParseCommandArgsArgs {
  command: CommandName;
  argv: readonly string[];
}

/**
 * The command line split into its two kinds of token.
 *
 * name - the single positional, already checked to be the only one.
 * values - every `--flag value` pair, keyed by the flag as typed.
 */
interface SplitTokens {
  name: string;
  values: ReadonlyMap<string, string>;
}

/**
 * Arguments of `onlyPositional`.
 *
 * command - named in the error, so the message says which command was
 *   given the wrong number of names.
 * positional - the non-flag tokens, in the order they were typed.
 */
interface OnlyPositionalArgs {
  command: CommandName;
  positional: readonly string[];
}

/**
 * Arguments of `resolveInput`.
 *
 * typed - the value of `--input`, relative to the working directory.
 * configured - the file the settings file names, already absolute.
 */
interface ResolveInputArgs {
  typed?: string | undefined;
  configured?: string | undefined;
}

/**
 * Arguments of `runCommand`.
 *
 * command - which command the first token named.
 * argv - the whole command line, command word included; the parser is
 *   handed what follows it.
 */
interface RunCommandArgs {
  command: CommandName;
  argv: readonly string[];
}

/**
 * Arguments of `demandOwnFlag`.
 *
 * command - which command's required flag is being read. Narrowed to the
 *   commands that declare one, so the lookup cannot come back empty.
 * values - every `--flag value` pair the command line carried.
 */
interface DemandOwnFlagArgs {
  command: 'add' | 'edit';
  values: ReadonlyMap<string, string>;
}

export type {
  AddCommandArgs,
  CommandArgs,
  CommandFlagSpec,
  CommandName,
  DemandOwnFlagArgs,
  EditCommandArgs,
  OnlyPositionalArgs,
  ParseCommandArgsArgs,
  RemoveCommandArgs,
  ResolveInputArgs,
  RunCommandArgs,
  SplitTokens,
};
