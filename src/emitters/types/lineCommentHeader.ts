import type { ParsedEvent } from '../../events/types/event';

/**
 * Arguments of `renderLineCommentHeader`.
 *
 * events - what the file exposes, listed with the ids they were given.
 * regenerateCommand - printed verbatim. It names the target and the
 *   directories a run cannot omit - the code directory, and the asset
 *   directory where the target has one; it is not the whole invocation,
 *   so a project whose definitions file is elsewhere adds `--input`.
 * formatterHint - what a reader of this language would tell to leave the
 *   file alone, named so the advice is actionable: the ignore files where
 *   the language has them, the tools themselves where it does not.
 * commentPrefix - how this language starts a line comment; `//` when
 *   omitted, which is every target but Python.
 */
interface LineCommentHeaderArgs {
  events: readonly ParsedEvent[];
  regenerateCommand: string;
  formatterHint: string;
  commentPrefix?: string;
}

export type { LineCommentHeaderArgs };
