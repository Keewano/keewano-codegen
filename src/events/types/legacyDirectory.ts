import type { CustomEventTypeValue } from '../customEventType';

/**
 * One event read out of the old per-file layout.
 *
 * name - the `n` field.
 * type - the `t` tag.
 * id - the `id` field, when the file carried one; the files written
 *   before ids were recorded have none.
 */
interface LegacyEvent {
  name: string;
  type: CustomEventTypeValue;
  id: number | undefined;
}

/**
 * A file in the old folder that could not be read as an old definition,
 * and so is missing from the rendered file.
 *
 * name - the file's basename.
 * problem - what the read said.
 */
interface UnreadableFile {
  name: string;
  problem: string;
}

/**
 * Everything the old folder yielded.
 *
 * events - the definitions read, in file-name order.
 * unreadable - the files that could not be read as an old definition.
 */
interface LegacyListing {
  events: readonly LegacyEvent[];
  unreadable: readonly UnreadableFile[];
}

/**
 * An event whose hand-written id the new file cannot keep.
 *
 * name - the event.
 * oldId - what the old file said.
 * newId - what its position in the new file gives it.
 */
interface RenumberedEvent {
  name: string;
  oldId: number;
  newId: number;
}

/**
 * The old layout, rendered.
 *
 * text - the definitions file the old directory becomes.
 * renumbered - every event whose id that file changes; empty when the
 *   old numbering was the positional one.
 * unreadable - the files the rendered file could not include.
 */
interface LegacyDescription {
  text: string;
  renumbered: readonly RenumberedEvent[];
  unreadable: readonly UnreadableFile[];
}

/**
 * Arguments of `refuseLegacyDirectory`.
 *
 * inputFile - the path `--input` resolved to.
 * label - the error prefix naming it, shared with every other refusal.
 */
interface RefuseLegacyDirectoryArgs {
  inputFile: string;
  label: string;
}

export type {
  LegacyDescription,
  LegacyEvent,
  LegacyListing,
  RefuseLegacyDirectoryArgs,
  RenumberedEvent,
  UnreadableFile,
};
