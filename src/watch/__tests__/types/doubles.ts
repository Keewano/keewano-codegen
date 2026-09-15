import type { ChokidarLike, WatchOptions } from '../../types/watchLoop';

/**
 * One `watch()` call the double recorded.
 *
 * root - the directory handed to the watcher.
 * options - the options the loop passed.
 */
interface WatchCall {
  root: string;
  options: WatchOptions;
}

/**
 * The in-memory watcher double.
 *
 * chokidar - what the loader seam hands to the loop.
 * fire - raise one watcher event at the loop's listeners.
 * watchCalls - every `watch()` call, in order.
 * addedPaths - every path put back under watch with `add()`, in order.
 */
interface FakeWatcher {
  chokidar: ChokidarLike;
  fire: (event: string, ...eventArgs: unknown[]) => void;
  watchCalls: WatchCall[];
  addedPaths: string[];
}

export type { FakeWatcher, WatchCall };
