/**
 * The byte contract of the map writer, pinned against the same
 * vectors the SDK core encoders are tested with. These primitives
 * used to be imported from the SDK; the vectors are what proves the
 * local copy writes identical bytes.
 */
import { FNV1A_32, MapWriter, fnv1a32 } from '../mapWriter';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const hex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
const write = (writeWith: (writer: MapWriter) => void): string => {
  const writer = new MapWriter();
  writeWith(writer);
  return hex(writer.toBytes());
};

describe('fnv1a32', () => {
  it('returns the offset basis for empty input', () => {
    expect(fnv1a32(new Uint8Array())).toBe(FNV1A_32.OFFSET_BASIS);
    expect(FNV1A_32.OFFSET_BASIS).toBe(0x811c9dc5);
    expect(FNV1A_32.PRIME).toBe(0x01000193);
  });

  it.each([
    ['a', 0xe40c292c],
    ['foobar', 0xbf9cf968],
  ])('matches the reference vector for %j', (input, expected) => {
    expect(fnv1a32(utf8(input))).toBe(expected);
  });

  it('is unsigned across the whole uint32 range', () => {
    for (const input of ['', 'a', 'foobar', ' ', '￿']) {
      const hash = fnv1a32(utf8(input));
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('MapWriter.writeUint16LE', () => {
  it.each([
    [0, '00 00'],
    [1, '01 00'],
    [0x0102, '02 01'],
    [2500, 'C4 09'],
    [0xffff, 'FF FF'],
  ])('writes %i little-endian', (value, expected) => {
    expect(write((writer) => writer.writeUint16LE(value))).toBe(expected);
  });

  it.each([-1, 0x10000, 1.5, Number.NaN])('rejects %p', (value) => {
    expect(() => write((writer) => writer.writeUint16LE(value))).toThrow(RangeError);
  });
});

describe('MapWriter.writeVarintU', () => {
  it.each([
    [0, '00'],
    [1, '01'],
    [127, '7F'],
    [128, '80 01'],
    [255, 'FF 01'],
    [16383, 'FF 7F'],
    [16384, '80 80 01'],
    [0xffffffff, 'FF FF FF FF 0F'],
  ])('encodes %i as unsigned LEB128', (value, expected) => {
    expect(write((writer) => writer.writeVarintU(value))).toBe(expected);
  });

  it.each([-1, 1.5, 0x100000000, Number.NaN, Number.POSITIVE_INFINITY])('rejects %p', (value) => {
    expect(() => write((writer) => writer.writeVarintU(value))).toThrow(RangeError);
  });
});

describe('MapWriter.writeString', () => {
  it.each([
    ['', '00'],
    ['Hello', '05 48 65 6C 6C 6F'],
    ['\u{1F600}', '04 F0 9F 98 80'],
  ])('writes %j as varint length + UTF-8', (value, expected) => {
    expect(write((writer) => writer.writeString(value))).toBe(expected);
  });

  it('prefixes the UTF-8 BYTE length, not the code-unit count', () => {
    /** Six Greek letters: 6 UTF-16 code units, 12 UTF-8 bytes. */
    const bytes = new MapWriter();
    bytes.writeString('αβγδεζ');
    expect(bytes.toBytes()[0]).toBe(12);
    expect(bytes.toBytes()).toHaveLength(13);
  });
});

describe('MapWriter growth', () => {
  it('grows past its initial capacity without losing bytes', () => {
    const w = new MapWriter();
    const chunk = 'x'.repeat(700);
    w.writeString(chunk);
    w.writeString(chunk);
    const out = w.toBytes();
    /** 2 * (2-byte varint + 700 bytes) */
    expect(out).toHaveLength(2 * (2 + 700));
    expect(out[0]).toBe(0xbc);
    expect(out[1]).toBe(0x05);
  });

  it('returns a copy, so later writes do not mutate an earlier snapshot', () => {
    const w = new MapWriter();
    w.writeUint16LE(1);
    const first = w.toBytes();
    w.writeUint16LE(2);
    expect(hex(first)).toBe('01 00');
  });
});
