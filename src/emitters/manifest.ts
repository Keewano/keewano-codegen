/**
 * The optional readable artifact: the same base64 blob every binary
 * SDK uploads, wrapped with what the blob alone cannot tell a reader -
 * the event ids, names and payload types, and the version stamp. Off
 * by default; it exists for a language that has no emitter yet (its
 * SDK can consume this directly instead of decoding the map) and for
 * checking a schema against the backend without a decoder.
 *
 * `dataType` uses the server's own spelling so a consumer never keeps
 * a translation table of its own. Deterministic: fixed key order,
 * two-space JSON, trailing newline.
 */

import type { BuildManifestArgs, ManifestDocument } from './types/manifest';

import { CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE } from '../events/customEventType';
import { buildCustomEventSet } from '../set/buildCustomEventSet';

const MANIFEST_SCHEMA_VERSION = 1;

/**
 * The blob is built here from the events being written, not taken from the
 * caller beside them. Handed both halves, a build script could pair one list
 * with another list's blob, and the document would carry a version and a base64
 * map describing a set its own `events` array does not - with no field in it
 * looking wrong. There is no second half to disagree with the first now, which
 * is the same reason `emitGeneratedSource` rebuilds rather than accepts.
 *
 * `buildCustomEventSet` holds the list to the contract on the way through, so a
 * type outside the seven is refused here rather than rendered as a `dataType`
 * the document type declares required and `JSON.stringify` then omits, and a
 * list out of wire-id order is refused rather than written under a doc that
 * promises that order.
 *
 * It costs one build. The only caller that writes this file also emits a
 * generated module, which builds the set for itself, so the pass was already
 * being paid on that path.
 */
function buildManifest({ events }: BuildManifestArgs): ManifestDocument {
  const built = buildCustomEventSet(events);
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    version: built.version,
    eventCount: built.eventCount,
    gzipDataBase64: Buffer.from(built.gzipData).toString('base64'),
    events: events.map((event) => ({
      id: event.id,
      name: event.name,
      type: event.type,
      dataType: CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE[event.type],
    })),
  };
}

function renderManifest(input: BuildManifestArgs): string {
  return `${JSON.stringify(buildManifest(input), null, 2)}\n`;
}

export { MANIFEST_SCHEMA_VERSION, buildManifest, renderManifest };
