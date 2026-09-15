/**
 * Test doubles for the watch loop: an in-memory watcher behind the
 * chokidar loader seam, a fixed argument set, and helpers to advance
 * the event loop, wait out the debounce, and raise process signals at
 * the loop's own listeners.
 */

import type { WatcherLike } from '../../types/watchLoop';
import type { FakeWatcher, WatchCall } from '../types/doubles';

import { WATCH_DEBOUNCE_MS } from '../../debouncer';
import { REATTACH_POLL_MS } from '../../reattach';

/** Longer than the debounce window, so a scheduled run has fired by then. */
const PAST_DEBOUNCE_MS = WATCH_DEBOUNCE_MS + 50;

/** Longer than one poll for the folder's return, plus the run it schedules. */
const PAST_REATTACH_POLL_MS = REATTACH_POLL_MS + PAST_DEBOUNCE_MS;

function makeFakeWatcher(closeImpl?: () => Promise<void>): FakeWatcher {
  const listeners = new Map<string, Array<(...eventArgs: unknown[]) => void>>();
  const watchCalls: WatchCall[] = [];
  const addedPaths: string[] = [];
  const watcher: WatcherLike = {
    add(paths) {
      addedPaths.push(paths);
    },
    on(event, listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return watcher;
    },
    off(event, listener) {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((registered) => registered !== listener),
      );
      return watcher;
    },
    close: closeImpl ?? ((): Promise<void> => Promise.resolve()),
  };
  return {
    chokidar: {
      watch: (root, options) => {
        watchCalls.push({ root, options });
        return watcher;
      },
    },
    fire: (event, ...eventArgs) => {
      for (const listener of listeners.get(event) ?? []) listener(...eventArgs);
    },
    watchCalls,
    addedPaths,
  };
}

const LOOP_ARGS = { inputFile: 'events/keewano.events.json' } as const;

const tick = (): Promise<void> => new Promise((resolveTick) => setImmediate(resolveTick));

const waitPastDebounce = (): Promise<void> =>
  new Promise((resolveWait) => setTimeout(resolveWait, PAST_DEBOUNCE_MS));

const waitPastReattachPoll = (): Promise<void> =>
  new Promise((resolveWait) => setTimeout(resolveWait, PAST_REATTACH_POLL_MS));

/** Fire a process signal at the loop's own listeners (no jest handlers live in the worker). */
const emitSignal = (name: NodeJS.Signals): void => {
  process.emit(name);
};

export { LOOP_ARGS, emitSignal, makeFakeWatcher, tick, waitPastDebounce, waitPastReattachPoll };
