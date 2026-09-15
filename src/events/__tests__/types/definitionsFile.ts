import type { DefinitionEntryArgs } from '../../types/definitionsDocument';
import type { ParsedEvent } from '../../types/event';

/**
 * Arguments of `makeEvent`.
 *
 * name - event name.
 * type - payload type tag.
 * indexOffset - offset from the first custom id; the id is 2500 + this.
 */
interface MakeEventArgs {
  name: string;
  type: ParsedEvent['type'];
  indexOffset: number;
}

/**
 * Arguments of `writeDefinitionsFile`.
 *
 * file - where the definitions file is written.
 * events - the entries, in the order the file declares them - which is
 *   the order that gives each its id - each as `definitionEntry` takes it.
 */
interface WriteDefinitionsFileArgs {
  file: string;
  events: readonly DefinitionEntryArgs[];
}

/**
 * Arguments of `writeRawDefinitionsFile`.
 *
 * file - where the file is written.
 * body - any JSON-serialisable value, written verbatim.
 */
interface WriteRawDefinitionsFileArgs {
  file: string;
  body: unknown;
}

/**
 * Arguments of `writeLegacyEventFile`.
 *
 * directory - the old per-event folder.
 * name - the file's basename, which the old layout equated with `n`.
 * body - the file's JSON, written verbatim: `{ id, n, t }` as those files
 *   were written, or whatever shape a test needs.
 */
interface WriteLegacyEventFileArgs {
  directory: string;
  name: string;
  body: unknown;
}

export type {
  MakeEventArgs,
  WriteDefinitionsFileArgs,
  WriteLegacyEventFileArgs,
  WriteRawDefinitionsFileArgs,
};
