/**
 * The guard on the identifier a target actually declares.
 *
 * The boundary's other checks compare the event name, which equals the
 * emitted spelling only where the template interpolates it unchanged.
 * Python lower-cases and inserts underscores, so two distinct legal names
 * can reach one definition - and Python keeps the last, which made the
 * first event unreportable and routed its calls to the other event's id
 * with nothing in the file looking wrong.
 */

import type { ParsedEvent } from '../../events/types/event';
import type { EmitTarget } from '../types/emit';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { ParseError } from '../../shared/errors';
import { emitGeneratedSource } from '../emit';
import { TARGET_NAMES, getEmitter } from '../registry';

const pair = (first: string, second: string): ParsedEvent[] => [
  makeEvent({ name: first, type: 1, indexOffset: 0 }),
  makeEvent({ name: second, type: 2, indexOffset: 1 }),
];

const emit = (events: readonly ParsedEvent[], target: EmitTarget) => () =>
  emitGeneratedSource({ events, target });

describe('reporter-name collisions', () => {
  it.each([
    ['LevelUp', 'Level_Up'],
    ['ABTest', 'AbTest'],
    ['USDPrice', 'UsdPrice'],
    ['Event00', 'EVENT00'],
  ])('refuses %s beside %s, which python spells the same way', (first, second) => {
    expect(emit(pair(first, second), 'python')).toThrow(ParseError);
    expect(emit(pair(first, second), 'python')).toThrow(/both emit report_/);
  });

  it('names both events, so the reader knows which two to rename', () => {
    expect(emit(pair('LevelUp', 'Level_Up'), 'python')).toThrow(
      'emit: "LevelUp" and "Level_Up" both emit report_level_up',
    );
  });

  it.each(['react-native', 'expo', 'node', 'web', 'kotlin', 'swift'] as const)(
    'still accepts the same pair for %s, which spells them apart',
    (target) => {
      expect(emit(pair('LevelUp', 'Level_Up'), target)).not.toThrow();
    },
  );
});

describe('reporter names that shadow a built-in', () => {
  it.each(['Button_Click', 'BUTTON_CLICK', 'Button_click'])(
    'refuses %s, which python spells like the SDK own reporter',
    (name) => {
      const events = [makeEvent({ name, type: 1, indexOffset: 0 })];
      expect(emit(events, 'python')).toThrow(ParseError);
      expect(emit(events, 'python')).toThrow(
        `emit: "${name}" emits report_button_click, a built-in report method`,
      );
    },
  );

  it('leaves an unrelated name alone', () => {
    expect(
      emit([makeEvent({ name: 'EnemyKilled', type: 1, indexOffset: 0 })], 'python'),
    ).not.toThrow();
  });
});

describe('every emitter declares how it spells a reporter', () => {
  /**
   * Asked of all of them rather than of the one that transforms today:
   * the guard reads this, so a target that arrives without it would be
   * unguarded by default.
   */
  it.each(TARGET_NAMES)('%s answers with the identifier its template writes', (target) => {
    const spelled = getEmitter(target).reporterNameFor('EnemyKilled');
    expect(typeof spelled).toBe('string');
    const source = emitGeneratedSource({
      events: [makeEvent({ name: 'EnemyKilled', type: 1, indexOffset: 0 })],
      target,
    });
    expect(source).toContain(spelled);
  });
});
