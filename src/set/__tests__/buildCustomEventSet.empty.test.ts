/**
 * A project that ran the generator before declaring its first event.
 * The list is empty, and what the set says about that is the difference
 * between an SDK that reports normally and one that reports nothing:
 * every SDK reads version `0` as "no custom-event schema" and skips the
 * whole custom-event path, while any other value sends it looking for a
 * schema to register and holds every upload until it finds one.
 */

import { buildCustomEventSet } from '../buildCustomEventSet';

describe('buildCustomEventSet: no events declared', () => {
  it('stamps the version the wire reserves for "no schema"', () => {
    expect(buildCustomEventSet([])).toEqual({
      version: 0,
      eventCount: 0,
      gzipData: new Uint8Array(),
    });
  });

  it('does not hash the gzip of nothing, which would look like a real schema', () => {
    /**
     * Gzipping an empty stream still produces a header and a trailer,
     * and hashing those yields a confident non-zero stamp describing no
     * events at all. That is what an SDK would then try to register.
     */
    expect(buildCustomEventSet([]).version).not.toBe(725481213);
  });

  it('hands every caller its own result, so one cannot poison the next', () => {
    /**
     * The function is exported, so the caller is not necessarily ours, and
     * watch mode keeps one process across many regenerations. A shared
     * module-level result would carry a mutation into every later empty
     * build - the same reason the non-empty path returns a fresh object.
     */
    const first = buildCustomEventSet([]);
    const second = buildCustomEventSet([]);

    expect(first).not.toBe(second);
    expect(first.gzipData).not.toBe(second.gzipData);

    first.version = 999;
    expect(buildCustomEventSet([]).version).toBe(0);
  });

  it('still stamps a real version once one event exists', () => {
    const built = buildCustomEventSet([{ name: 'Tap', type: 0, id: 2500 }]);
    expect(built.version).not.toBe(0);
    expect(built.eventCount).toBe(1);
    expect(built.gzipData.length).toBeGreaterThan(0);
  });
});
