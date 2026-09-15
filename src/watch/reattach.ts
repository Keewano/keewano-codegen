/**
 * Putting the watch back after the watched directory disappears. chokidar
 * accepts a path that does not exist yet, but only while something above
 * it still does: a checkout that replaces the parent leaves nothing to
 * hang the watch on, and the loop would sit there watching an inode
 * nobody writes to. So the path is polled instead - one mechanism for
 * both cases - and the watch is restored the moment it is back.
 */

import type { CreateReattacherArgs, Reattacher } from './types/reattach';

import { existsSync } from 'node:fs';

/** Long enough to be free, short enough that a checkout feels instant. */
const REATTACH_POLL_MS = 500;

function createReattacher({
  watcher,
  inputDirectory,
  onReattached,
}: CreateReattacherArgs): Reattacher {
  let poll: ReturnType<typeof setInterval> | undefined;

  const stop = (): void => {
    if (poll !== undefined) clearInterval(poll);
    poll = undefined;
  };

  const start = (): void => {
    stop();
    poll = setInterval(() => {
      if (!existsSync(inputDirectory)) return;
      stop();
      watcher.add(inputDirectory);
      onReattached();
    }, REATTACH_POLL_MS);
    /** The watcher keeps the process alive; this timer must not. */
    poll.unref();
  };

  return { start, stop };
}

export { REATTACH_POLL_MS, createReattacher };
