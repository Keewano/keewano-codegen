/**
 * The one step of the pipeline that rewrites bytes it did not produce:
 * gzip's informational header. Every case here is a byte the hash would
 * otherwise carry from the machine that ran the build.
 */

import { normalizeGzipHeader } from '../buildCustomEventSet';

describe('normalizeGzipHeader', () => {
  it('zeroes MTIME (bytes 4..7), zeroes XFL (byte 8), sets OS (byte 9) to 0xFF', () => {
    const fake = new Uint8Array([
      0x1f, 0x8b, 0x08, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x03, 0xff, 0xff,
    ]);
    const normalized = normalizeGzipHeader(fake);
    expect(Array.from(normalized.subarray(0, 10))).toEqual([
      0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff,
    ]);
  });

  it('returns the bytes unchanged when shorter than 10 bytes (incomplete gzip header)', () => {
    const tiny = new Uint8Array([0x1f, 0x8b, 0x08]);
    const result = normalizeGzipHeader(tiny);
    expect(Array.from(result)).toEqual([0x1f, 0x8b, 0x08]);
    /**
     * A copy, like every other path returns. Handing the argument back
     * here would make ownership depend on the input length, which no
     * caller can see, so the assertion is on identity and not only on
     * the values.
     */
    expect(result).not.toBe(tiny);
    tiny[0] = 0x00;
    expect(result[0]).toBe(0x1f);
  });

  it('preserves bytes after the 10-byte header (deflate stream untouched)', () => {
    const fake = new Uint8Array([
      0x1f, 0x8b, 0x08, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x03, 0xaa, 0xbb, 0xcc, 0xdd,
    ]);
    expect(Array.from(normalizeGzipHeader(fake).subarray(10))).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);
  });
});
