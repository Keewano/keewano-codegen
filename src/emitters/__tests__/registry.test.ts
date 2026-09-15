/**
 * The emitter registry is the only place that knows which targets
 * exist; the CLI help, the validation errors and the conformance suite
 * all derive their target list from it, so its shape is pinned here.
 */
import { DEFAULT_TARGET, TARGET_NAMES, getEmitter, isEmitTarget } from '../registry';

describe('emitter registry', () => {
  it('lists the targets in declaration order, with the default among them', () => {
    expect(TARGET_NAMES).toEqual([
      'react-native',
      'expo',
      'node',
      'web',
      'kotlin',
      'swift',
      'python',
    ]);
    expect(TARGET_NAMES).toContain(DEFAULT_TARGET);
  });

  it.each(TARGET_NAMES)('accepts %s and resolves an emitter for it', (target) => {
    expect(isEmitTarget(target)).toBe(true);
    expect(
      getEmitter(target).emit({
        events: [],
        built: { version: 0, eventCount: 0, gzipData: new Uint8Array() },
      }),
    ).toContain('AUTO-GENERATED');
  });

  it.each(['flutter', '', 'React-Native', '__proto__', 'constructor', 'toString'])(
    'rejects %p, including names that exist on the prototype chain',
    (value) => {
      expect(isEmitTarget(value)).toBe(false);
    },
  );
});
