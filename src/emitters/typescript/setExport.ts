/**
 * The `customEventSet` export of the generated TypeScript module: the
 * binary payload (gzip bytes + FNV-1a version) as literals, plus the
 * readable `events` list the runtime uses to resolve a name to its
 * wire id and type. Deterministic by construction.
 */

import type { ParsedEvent } from '../../events/types/event';
import type { BuiltEvents } from '../../set/types/buildCustomEventSet';

const HEX = {
  RADIX: 16,
  BYTE_WIDTH: 2,
  UINT32_WIDTH: 8,
} as const;

function renderSetExport({ built, events }: BuiltEvents): string {
  const versionLiteral = `0x${built.version
    .toString(HEX.RADIX)
    .toUpperCase()
    .padStart(HEX.UINT32_WIDTH, '0')}`;
  return [
    'export const customEventSet: CustomEventSet = {',
    `  version: ${versionLiteral},`,
    `  eventCount: ${String(built.eventCount)},`,
    `  gzipData: new Uint8Array(${formatBytesLiteral(built.gzipData)}),`,
    `  events: ${renderEventsLiteral(events)},`,
    '};',
  ].join('\n');
}

/**
 * The id is written out beside each event rather than derived from its
 * position by the SDK: the set the SDK builds takes ids as data, and a
 * file that says what it reports needs no reader to know the numbering
 * rule.
 */
function renderEventsLiteral(events: readonly ParsedEvent[]): string {
  if (events.length === 0) return '[]';
  const entries = events
    .map((event) => `    { id: ${event.id}, name: '${event.name}', type: ${event.type} }`)
    .join(',\n');
  return `[\n${entries},\n  ]`;
}

function formatBytesLiteral(bytes: Uint8Array): string {
  if (bytes.length === 0) return '[]';
  const tokens: string[] = [];
  for (const byte of bytes) {
    tokens.push(`0x${byte.toString(HEX.RADIX).toUpperCase().padStart(HEX.BYTE_WIDTH, '0')}`);
  }
  return `[${tokens.join(', ')}]`;
}

export { renderSetExport };
