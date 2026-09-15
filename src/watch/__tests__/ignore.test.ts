/**
 * The predicate handed to chokidar: everything under the watched
 * directory is ignored except the definitions file, and the root itself
 * is never ignored.
 */

import { join, resolve } from 'node:path';

import { makeIgnoredPredicate } from '../ignore';

/** A dot-named directory holding the definitions file, so the root rule is tested where it bites. */
const DOT_ROOT = '.dot-events';
const DOT_FILE = `${DOT_ROOT}/keewano.events.json`;

/** A plain directory and the definitions file inside it. */
const ROOT = 'events';
const FILE = 'events/keewano.events.json';

describe('makeIgnoredPredicate: the root', () => {
  it('never ignores the watch root itself, even when the root is dot-named', () => {
    /**
     * Regression: chokidar applies `ignored` to the watch ROOT before
     * descending. A predicate that ignored a dot-named directory outright
     * left the watcher watching nothing, and `--watch` never fired,
     * silently.
     */
    const ignored = makeIgnoredPredicate(DOT_FILE);
    expect(ignored(DOT_ROOT)).toBe(false);
  });

  it('accepts the root in resolved (absolute) form too, as chokidar reports it', () => {
    const ignored = makeIgnoredPredicate(DOT_FILE);
    expect(ignored(resolve(DOT_ROOT))).toBe(false);
  });
});

describe('makeIgnoredPredicate: the definitions file', () => {
  it('keeps the definitions file watchable, in relative and resolved form', () => {
    const ignored = makeIgnoredPredicate(FILE);
    expect(ignored(FILE)).toBe(false);
    expect(ignored(resolve(FILE))).toBe(false);
  });

  it('matches the file however the listing spells its case', () => {
    /**
     * chokidar reports the on-disk spelling; `--input` is the caller's.
     * On a case-insensitive filesystem the two name one file, and a
     * predicate that compared them exactly ignored it - a watch that
     * never fires and never says so.
     */
    const ignored = makeIgnoredPredicate(FILE);
    expect(ignored(join(ROOT, 'Keewano.Events.JSON'))).toBe(false);
  });
});

describe('makeIgnoredPredicate: everything else under the root', () => {
  const ignored = makeIgnoredPredicate(FILE);

  it.each([
    ['a generated module written beside the definitions', 'keewano-events.generated.ts'],
    [
      'the manifest, whose name differs from the definitions by one character',
      'keewano-events.json',
    ],
    ['a dot-named entry', '.hidden'],
    ['a sub-directory, so the watch never descends into it', 'nested'],
  ])('ignores %s', (_, entry) => {
    expect(ignored(join(ROOT, entry))).toBe(true);
  });
});
