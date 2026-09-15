import type { WatcherLike } from './watchLoop';

/**
 * Arguments of `waitForShutdown`.
 *
 * watcher - the live watcher; closed on shutdown and on error.
 * onShutdown - called once, before the watcher is closed, on either path.
 */
interface WaitForShutdownArgs {
  watcher: WatcherLike;
  onShutdown: () => void;
}

export type { WaitForShutdownArgs };
