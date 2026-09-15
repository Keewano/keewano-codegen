import type { WatcherLike } from './watchLoop';

/**
 * Arguments of `createReattacher`.
 *
 * watcher - the live watcher whose watch has to be restored.
 * inputDirectory - the path being waited for; polled until it exists.
 * onReattached - called once the watch is back, so the folder's return
 *   is reported like any other change.
 */
interface CreateReattacherArgs {
  watcher: WatcherLike;
  inputDirectory: string;
  onReattached: () => void;
}

/**
 * The polling handle.
 *
 * start - begin waiting for the folder (restarts a wait in progress).
 * stop - give up waiting; safe to call when not waiting.
 */
interface Reattacher {
  start: () => void;
  stop: () => void;
}

export type { CreateReattacherArgs, Reattacher };
