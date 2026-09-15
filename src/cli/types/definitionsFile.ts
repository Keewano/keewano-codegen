import type { RawEventDefinitions } from '../../events/types/event';

/**
 * Arguments of `writeDefinitions`.
 *
 * inputFile - the definitions file, written in place.
 * definitions - the document to write.
 */
interface WriteDefinitionsArgs {
  inputFile: string;
  definitions: RawEventDefinitions;
}

export type { WriteDefinitionsArgs };
