/**
 * How the watch loop ends: a signal or a watcher error, whichever comes
 * first, and never twice.
 */

import type { WaitForShutdownArgs } from './types/shutdown';

import { stringifyError } from '../shared/stringifyError';

/**
 * Resolves on SIGINT / SIGTERM after the watcher closed; rejects with
 * the watcher's own error on `error`, because an unhandled `error` event
 * on an EventEmitter would otherwise kill the process. The error
 * listener stays attached for the watcher's lifetime: a second error
 * with no listener would throw.
 */
function waitForShutdown({ watcher, onShutdown }: WaitForShutdownArgs): Promise<void> {
  return new Promise<void>((resolveLoop, rejectLoop) => {
    let isShuttingDown = false;
    /**
     * Closing can fail (a watcher that never started, a handle already
     * gone); either way the loop is over, so `settle` decides the
     * outcome and a failed close is not a second failure to report.
     */
    const finish = (settle: () => void): void => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      onShutdown();
      process.off('SIGINT', shutdown);
      process.off('SIGTERM', shutdown);
      watcher.close().then(settle, settle);
    };
    const shutdown = (): void => finish(resolveLoop);
    const onError = (error: unknown): void => {
      const reason = error instanceof Error ? error : new Error(stringifyError(error));
      finish(() => rejectLoop(reason));
    };
    watcher.on('error', onError);
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}

export { waitForShutdown };
