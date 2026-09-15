/**
 * The comparator that decides wire ids, and the reason it is written by
 * hand instead of calling `localeCompare`: collation is a property of
 * the machine, ids are a property of the contract. Every pair below is
 * one the two disagree on, and the test says so out loud - if a pair
 * ever stopped disagreeing it would still pass while proving nothing,
 * which is exactly how this went unnoticed before.
 */

import { compareOrdinal } from '../compareOrdinal';

/** [smaller by code unit, larger by code unit] - and locale order says the opposite. */
const DISAGREEING_PAIRS = [
  ['ItemA', 'Item_A'], // '_' (0x5F) comes after 'A' (0x41)
  ['ItemA', 'Itema'], // uppercase before lowercase
  ['Item0', 'Item_0'], // digits before '_'
  ['ItemZ', 'Itemb'], // every uppercase letter before every lowercase one
] as const;

describe('compareOrdinal', () => {
  it.each(DISAGREEING_PAIRS)('orders %s before %s by code unit', (smaller, larger) => {
    expect(compareOrdinal(smaller, larger)).toBeLessThan(0);
    expect(compareOrdinal(larger, smaller)).toBeGreaterThan(0);
  });

  it.each(DISAGREEING_PAIRS)('disagrees with locale collation on %s / %s', (smaller, larger) => {
    expect(smaller.localeCompare(larger)).toBeGreaterThan(0);
  });

  it('reports equal names as equal', () => {
    expect(compareOrdinal('Item', 'Item')).toBe(0);
  });
});
