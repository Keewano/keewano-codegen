/**
 * Per-target differences in the generated source: the node relay
 * reporter style, the web top-level style, and target validation.
 */

import type { EmitTarget } from '../types/emit';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { emitGeneratedSource } from '../emit';

describe('emitGeneratedSource: node target (relay reporter style)', () => {
  it('imports CustomEventSet + UserReporter from @keewano/node-sdk and no top-level Keewano', () => {
    const source = emitGeneratedSource({
      events: [makeEvent({ name: 'Tap', type: 0, indexOffset: 0 })],
      target: 'node',
    });
    expect(source).toMatch(
      /import type \{ CustomEventSet, UserReporter \} from '@keewano\/node-sdk'/,
    );
    expect(source).not.toMatch(/import \{ Keewano \}/);
  });

  it('threads a UserReporter param and forwards through reporter.reportCustomEvent', () => {
    const source = emitGeneratedSource({
      events: [makeEvent({ name: 'Score', type: 2, indexOffset: 0 })],
      target: 'node',
    });
    expect(source).toMatch(
      /export function reportScore\(reporter: UserReporter, value: number\): void \{/,
    );
    expect(source).toMatch(/reporter\.reportCustomEvent\(\{ name: 'Score', value \}\)/);
  });

  it('a None-typed event takes only the reporter parameter', () => {
    const source = emitGeneratedSource({
      events: [makeEvent({ name: 'Tap', type: 0, indexOffset: 0 })],
      target: 'node',
    });
    expect(source).toMatch(/export function reportTap\(reporter: UserReporter\): void \{/);
    expect(source).toMatch(/reporter\.reportCustomEvent\(\{ name: 'Tap' \}\)/);
  });

  it('emits the same customEventSet data block regardless of target', () => {
    const events = [makeEvent({ name: 'Alpha', type: 1, indexOffset: 0 })];
    const dataOf = (s: string): string => s.slice(s.indexOf('export const customEventSet'));
    const reference = dataOf(emitGeneratedSource({ events }));
    expect(dataOf(emitGeneratedSource({ events, target: 'node' }))).toBe(reference);
    expect(dataOf(emitGeneratedSource({ events, target: 'web' }))).toBe(reference);
  });
});

describe('emitGeneratedSource: web target', () => {
  it('imports from @keewano/web-sdk and forwards through the top-level Keewano', () => {
    const source = emitGeneratedSource({
      events: [makeEvent({ name: 'Score', type: 2, indexOffset: 0 })],
      target: 'web',
    });
    expect(source).toMatch(/import type \{ CustomEventSet \} from '@keewano\/web-sdk'/);
    expect(source).toMatch(/import \{ Keewano \} from '@keewano\/web-sdk'/);
    expect(source).toMatch(/export function reportScore\(value: number\): void \{/);
    expect(source).toMatch(/Keewano\.reportCustomEvent\(\{ name: 'Score', value \}\)/);
    expect(source).not.toMatch(/UserReporter/);
  });
});

describe('emitGeneratedSource: an empty set still has to compile in the host', () => {
  /**
   * The file is generated before any event exists (a fresh project, a
   * folder someone emptied) and the host compiles it with its own
   * settings; an import nothing uses fails a build under
   * `noUnusedLocals` on a file the host was told never to edit.
   */
  it.each(['web', 'react-native', 'expo'] as const)(
    'imports no value it cannot use for the %s target',
    (target) => {
      const source = emitGeneratedSource({ events: [], target });
      expect(source).toMatch(/import type \{ CustomEventSet \}/);
      expect(source).not.toMatch(/import \{ Keewano \}/);
    },
  );

  it('names no reporter type for the node target', () => {
    const source = emitGeneratedSource({ events: [], target: 'node' });
    expect(source).toMatch(/import type \{ CustomEventSet \} from '@keewano\/node-sdk'/);
    expect(source).not.toMatch(/UserReporter/);
  });
});

describe('emitGeneratedSource: target validation', () => {
  it('throws a clear EmitError on an unsupported target (untyped caller)', () => {
    expect(() => emitGeneratedSource({ events: [], target: 'flutter' as EmitTarget })).toThrow(
      /unsupported target "flutter"/,
    );
  });

  it('treats only an absent target as omitted, so null is rejected like any other bad value', () => {
    /**
     * A build script reading a nullable config field hands `null` through.
     * Defaulting on it would emit react-native wrappers into a project that
     * never asked for them - the one bad value that produces an artifact
     * rather than an error, and the hardest kind to notice in a workspace
     * that carries more than one SDK.
     */
    expect(() =>
      emitGeneratedSource({ events: [], target: null as unknown as EmitTarget }),
    ).toThrow(/unsupported target "null"/);
    expect(emitGeneratedSource({ events: [] })).toContain('@keewano/react-native-sdk');
  });

  it.each(['__proto__', 'constructor', 'toString'])(
    'rejects the prototype-chain key %p instead of resolving it through the prototype',
    (key) => {
      expect(() => emitGeneratedSource({ events: [], target: key as EmitTarget })).toThrow(
        /unsupported target/,
      );
    },
  );
});
