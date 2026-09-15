/**
 * The manifest is the one artifact a consumer without an emitter reads,
 * so its shape and spelling are a contract: the server's dataType names,
 * the base64 of the exact bytes the SDKs upload, ids in wire order, and
 * a byte-stable rendering.
 */
import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { CustomEventType } from '../../events/customEventType';
import { buildCustomEventSet } from '../../set/buildCustomEventSet';
import { MANIFEST_SCHEMA_VERSION, buildManifest, renderManifest } from '../manifest';

const events = [
  makeEvent({ name: 'BossKilled', type: CustomEventType.None, indexOffset: 0 }),
  makeEvent({ name: 'CoinPack', type: CustomEventType.PriceInUSDCents, indexOffset: 1 }),
  makeEvent({ name: 'IsPremium', type: CustomEventType.Bool, indexOffset: 2 }),
  makeEvent({ name: 'LastLogin', type: CustomEventType.Timestamp, indexOffset: 3 }),
  makeEvent({ name: 'LevelName', type: CustomEventType.String, indexOffset: 4 }),
  makeEvent({ name: 'MapPos', type: CustomEventType.UnsignedShortVec2, indexOffset: 5 }),
  makeEvent({ name: 'PlayerRank', type: CustomEventType.UnsignedInt, indexOffset: 6 }),
];

describe('buildManifest', () => {
  const manifest = buildManifest({ events });
  /** The same build the manifest makes for itself, to compare its fields against. */
  const built = buildCustomEventSet(events);

  it('carries the set version, count and the base64 of the exact registration bytes', () => {
    expect(manifest.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(manifest.version).toBe(built.version);
    expect(manifest.eventCount).toBe(7);
    expect(Buffer.from(manifest.gzipDataBase64, 'base64')).toEqual(Buffer.from(built.gzipData));
  });

  it('spells every dataType the way the ingestion service does', () => {
    /** In the order the parser hands the events over, which is by name, not by tag. */
    expect(manifest.events.map((e) => e.dataType)).toEqual([
      'none',
      'price_usd_cent',
      'bool',
      'timestamp',
      'string',
      'ushortvec2',
      'uint',
    ]);
  });

  it('lists ids in wire order with their names and numeric types', () => {
    expect(manifest.events[0]).toEqual({
      id: 2500,
      name: 'BossKilled',
      type: 0,
      dataType: 'none',
    });
    expect(manifest.events.map((e) => e.id)).toEqual([2500, 2501, 2502, 2503, 2504, 2505, 2506]);
  });
});

describe('renderManifest', () => {
  it('renders deterministic two-space JSON with a trailing newline', () => {
    const a = renderManifest({ events });
    const b = renderManifest({ events });
    expect(a).toBe(b);
    expect(a.endsWith('}\n')).toBe(true);
    expect(a.startsWith('{\n  "schemaVersion": 1,\n  "version": ')).toBe(true);
  });

  it('round-trips through JSON.parse', () => {
    const parsed = JSON.parse(renderManifest({ events })) as { events: unknown[] };
    expect(parsed.events).toHaveLength(7);
  });
});
