import type { ParsedEvent, RawEventDefinitions } from './event';

/**
 * Arguments of `parseEventDefinitions`.
 *
 * inputFile - absolute path of the definitions file.
 */
interface ParseEventDefinitionsArgs {
  inputFile: string;
}

/**
 * What the parser hands back: the document and the events it declares.
 *
 * definitions - the validated document, in the file's own shape, with
 *   nothing derived. A command that appends or renames writes this back,
 *   so it has to be exactly what is on disk.
 * events - every declared event in declaration order, each carrying the
 *   id its position gives it.
 */
interface ParseResult {
  definitions: RawEventDefinitions;
  events: readonly ParsedEvent[];
}

/**
 * Arguments of `readDocument`.
 *
 * inputFile - the path `--input` resolved to.
 * label - the error prefix naming the file, shared with every refusal.
 */
interface ReadDocumentArgs {
  inputFile: string;
  label: string;
}

/**
 * Arguments of `eventsOf`.
 *
 * definitions - a document the schema accepted.
 * label - the error prefix naming the file.
 */
interface EventsOfArgs {
  definitions: RawEventDefinitions;
  label: string;
}

/**
 * Arguments of `enforceEventCountCap`.
 *
 * count - how many entries the file declares.
 * label - the error prefix naming the file.
 */
interface EnforceEventCountCapArgs {
  count: number;
  label: string;
}

export type {
  EnforceEventCountCapArgs,
  EventsOfArgs,
  ParseEventDefinitionsArgs,
  ParseResult,
  ReadDocumentArgs,
};
