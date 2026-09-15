/**
 * `stringifyError` sits behind every diagnostic the CLI prints; every
 * catch site relies on it producing the same text for the same thrown
 * shape. Each case here is a shape a real throw can take.
 */
import { stringifyError } from '../stringifyError';

describe('stringifyError', () => {
  it('uses the message of an Error', () => {
    expect(stringifyError(new RangeError('out of range'))).toBe('out of range');
  });

  it('serializes a plain object as JSON', () => {
    expect(stringifyError({ code: 'ENOENT', path: 'x.json' })).toBe(
      '{"code":"ENOENT","path":"x.json"}',
    );
  });

  it('falls back to the tag when the object cannot be serialized', () => {
    /** A cycle makes JSON.stringify throw; the fallback must not. */
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(stringifyError(cyclic)).toBe('[object Object]');
  });

  it.each([
    ['a string', 'boom', 'boom'],
    ['a number', 42, '42'],
    ['null', null, 'null'],
    ['undefined', undefined, 'undefined'],
  ])('stringifies %s', (_label, value, expected) => {
    expect(stringifyError(value)).toBe(expected);
  });
});
