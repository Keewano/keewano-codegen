/**
 * The byte encoders behind the custom-event map. Three shapes and one
 * hash, all little-endian and all frozen: the server decodes exactly
 * this layout, and the FNV-1a stamp over it is what every SDK sends as
 * the map version. A change of one byte here would make the same event
 * set hash differently and look like a second schema server-side.
 *
 * The map is a plain concatenation with no header and no count prefix:
 *
 *   [uint16 LE id][varint UTF-8 length][UTF-8 name][uint16 LE type] * N
 *
 * The varint is unsigned LEB128: 7 bits per byte, low group first,
 * high bit set on every byte but the last. Same encoding as the length
 * prefix in front of every string on the SDK wire.
 */

import type { AssertIntInRangeArgs } from './types/mapWriter';

const FNV1A_32 = {
  OFFSET_BASIS: 0x811c9dc5,
  PRIME: 0x01000193,
} as const;

const LEB128 = {
  HIGH_BIT: 0x80,
  LOW_7_MASK: 0x7f,
  RADIX: 128,
} as const;

const BYTE = {
  MASK: 0xff,
  BITS: 8,
  UINT16_WIDTH: 2,
} as const;

const LIMITS = {
  UINT16_MAX: 0xffff,
  UINT32_MAX: 0xffffffff,
} as const;

/** Sized for typical sets; the buffer grows by GROWTH_FACTOR past it. */
const BUFFER = {
  INITIAL_CAPACITY: 1024,
  GROWTH_FACTOR: 2,
} as const;

const utf8Encoder = new TextEncoder();

/** FNV-1a 32-bit over `bytes`; the result is an unsigned uint32. */
function fnv1a32(bytes: Uint8Array): number {
  let hash = FNV1A_32.OFFSET_BASIS;
  for (const byte of bytes) {
    hash = Math.imul(hash ^ byte, FNV1A_32.PRIME) >>> 0;
  }
  return hash;
}

/** Growable byte sink; every write appends. */
class MapWriter {
  private buffer: Uint8Array;
  private length: number;

  constructor() {
    this.buffer = new Uint8Array(BUFFER.INITIAL_CAPACITY);
    this.length = 0;
  }

  writeUint16LE(value: number): void {
    assertIntInRange({ functionName: 'writeUint16LE', value, max: LIMITS.UINT16_MAX });
    this.ensure(BYTE.UINT16_WIDTH);
    this.buffer[this.length] = value & BYTE.MASK;
    this.buffer[this.length + 1] = (value >>> BYTE.BITS) & BYTE.MASK;
    this.length += BYTE.UINT16_WIDTH;
  }

  /** Unsigned LEB128 varint. */
  writeVarintU(value: number): void {
    assertIntInRange({ functionName: 'writeVarintU', value, max: LIMITS.UINT32_MAX });
    let remaining = value;
    while (remaining >= LEB128.HIGH_BIT) {
      this.writeUint8((remaining & LEB128.LOW_7_MASK) | LEB128.HIGH_BIT);
      remaining = Math.floor(remaining / LEB128.RADIX);
    }
    this.writeUint8(remaining & LEB128.LOW_7_MASK);
  }

  /** `[varint byte length][UTF-8 bytes]` - the wire's string layout. */
  writeString(value: string): void {
    const bytes = utf8Encoder.encode(value);
    this.writeVarintU(bytes.length);
    this.ensure(bytes.length);
    this.buffer.set(bytes, this.length);
    this.length += bytes.length;
  }

  /** A copy of the written bytes; the writer stays usable. */
  toBytes(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }

  private writeUint8(value: number): void {
    this.ensure(1);
    this.buffer[this.length] = value;
    this.length += 1;
  }

  private ensure(extra: number): void {
    const needed = this.length + extra;
    if (needed <= this.buffer.length) return;
    let capacity = this.buffer.length * BUFFER.GROWTH_FACTOR;
    while (capacity < needed) capacity *= BUFFER.GROWTH_FACTOR;
    const grown = new Uint8Array(capacity);
    grown.set(this.buffer.subarray(0, this.length));
    this.buffer = grown;
  }
}

function assertIntInRange({ functionName, value, max }: AssertIntInRangeArgs): void {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${functionName}: value out of range`);
  }
}

export { FNV1A_32, MapWriter, fnv1a32 };
