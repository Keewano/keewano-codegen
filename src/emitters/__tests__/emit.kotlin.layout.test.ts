/**
 * The Kotlin target's text as a reader and a linter meet it: the header
 * every file opens with, and the line shape of each wrapper. The
 * wrappers' contract and the asset are `emit.kotlin.test.ts`.
 */

import type { CustomEventTypeValue } from '../../events/customEventType';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { emitGeneratedSource } from '../emit';

const emitKotlin = (type: CustomEventTypeValue): string =>
  emitGeneratedSource({
    events: [makeEvent({ name: 'Tap', type, indexOffset: 0 })],
    target: 'kotlin',
  });

describe('the Kotlin target: the header', () => {
  it('lists the ids a reader needs, and says so when there are none', () => {
    expect(emitKotlin(2)).toContain('//   2500  Tap  (UnsignedInt)');
    expect(emitGeneratedSource({ events: [], target: 'kotlin' })).toContain(
      '//   (no events defined)',
    );
  });

  it('prints a regenerate command naming the target, the code directory and the asset directory', () => {
    /**
     * Both directories, because the CLI refuses a kotlin run without the
     * asset one; a printed command the CLI refuses is worse than none.
     * The command names no package: the contract fixes it, so there is
     * nothing to pass.
     */
    expect(emitKotlin(0)).toContain(
      'keewano-codegen --target kotlin --code <directory of this file> --asset <assets directory>',
    );
    expect(emitKotlin(0)).not.toContain('--package');
  });
});

describe('emitGeneratedSource: kotlin expression bodies', () => {
  /**
   * ktlint wants an expression body beside its declaration where it fits, and
   * says so on every wrapper the file has - which was the shape this emitted
   * until an Android developer ran the linter over it.
   */
  it('puts the body on the declaration line', () => {
    const source = emitGeneratedSource({
      events: [makeEvent({ name: 'SaveWorld', type: 0, indexOffset: 0 })],
      target: 'kotlin',
    });
    expect(source).toContain(
      'fun KeewanoSDK.reportSaveWorld() = KeewanoCodegen.reportCustomEvent(2500)',
    );
  });

  /**
   * And wraps instead where joining would break the other rule. An event name
   * may be 128 characters, so the joined line can pass 200 - which trades one
   * complaint for the next.
   */
  it('wraps the body when the joined line would be too long', () => {
    const name = `Save${'W'.repeat(120)}`;
    const source = emitGeneratedSource({
      events: [makeEvent({ name, type: 5, indexOffset: 0 })],
      target: 'kotlin',
    });
    expect(source).toContain(`fun KeewanoSDK.report${name}(x: Int, y: Int) =
    KeewanoCodegen.`);
    for (const line of source.split('\n')) {
      /** The declaration itself can still be too long; nothing but the name decides that. */
      if (line.includes('KeewanoCodegen.')) expect(line.length).toBeLessThanOrEqual(140);
    }
  });
});
