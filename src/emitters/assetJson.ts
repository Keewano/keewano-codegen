/**
 * The definition-set asset: `{ version, eventCount, gzipBase64 }` as the
 * Android SDK reads it at launch. It is not a language template - the
 * content is the built set itself, serialized - so it lives beside the
 * emitters rather than under one of them, and any target whose SDK loads
 * the set from a file rather than from source can declare it in the
 * registry.
 *
 * The rendering is deterministic byte for byte, like every other
 * artifact: fixed key order, two-space indentation, one trailing
 * newline.
 */

import type { RenderAssetJsonArgs } from './types/assetJson';

import { buildCustomEventSet } from '../set/buildCustomEventSet';

const JSON_INDENT = 2;

/**
 * The set is built here rather than accepted beside the events, for the reason
 * the manifest and the emitters do the same: an exported renderer that takes a
 * prebuilt half lets a caller pair it with a different list, and every field
 * still looks right. There is no half left to pair wrongly.
 */
function renderAssetJson({ events }: RenderAssetJsonArgs): string {
  const built = buildCustomEventSet(events);
  const asset = {
    version: built.version,
    eventCount: built.eventCount,
    gzipBase64: Buffer.from(built.gzipData).toString('base64'),
  };
  return `${JSON.stringify(asset, null, JSON_INDENT)}\n`;
}

export { renderAssetJson };
