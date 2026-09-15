import type { CustomEventTypeValue } from '../../events/customEventType';
import type { ParsedEvent } from '../../events/types/event';

/**
 * Arguments of `buildManifest` and `renderManifest`.
 *
 * events - the parsed list the document describes; the blob is built from it
 *   here rather than accepted beside it, so the two cannot disagree.
 */
interface BuildManifestArgs {
  events: readonly ParsedEvent[];
}

/**
 * One event as the manifest lists it.
 *
 * id - wire id: the first reserved id plus the position in the definitions file.
 * name - declared name, as it appears in the registration body.
 * type - numeric payload type tag.
 * dataType - the same type in the server's spelling.
 */
interface ManifestEvent {
  id: number;
  name: string;
  type: CustomEventTypeValue;
  dataType: string;
}

/**
 * The manifest document.
 *
 * schemaVersion - layout version of this document, bumped only if the
 *   shape changes; independent of the event set's `version`.
 * version - FNV-1a stamp of the normalized gzip bytes.
 * eventCount - number of events in the set.
 * gzipDataBase64 - the registration blob, base64 encoded.
 * events - readable list in wire-id order.
 */
interface ManifestDocument {
  schemaVersion: number;
  version: number;
  eventCount: number;
  gzipDataBase64: string;
  events: ManifestEvent[];
}

export type { BuildManifestArgs, ManifestDocument, ManifestEvent };
