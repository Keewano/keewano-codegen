/**
 * `--watch` loop. Lazy-loads `chokidar` so a one-shot CLI invocation
 * (`--help`, `--version`) does not pay for the file-watcher. The loop
 * resolves on SIGINT / SIGTERM with the exit code of the last re-emit
 * (`initialExit` if no change ever fired) and rejects if the watcher
 * itself errors, so both ends are visible to the CLI exit-code contract.
 */

import type { ChokidarLike, MakeRootRemovedHandlerArgs, RunWatchLoopArgs } from './types/watchLoop';

import { dirname, resolve } from 'node:path';

import { IoError } from '../shared/errors';
import { stringifyError } from '../shared/stringifyError';

import { createDebouncer } from './debouncer';
import { makeIgnoredPredicate } from './ignore';
import { createReattacher } from './reattach';
import { waitForShutdown } from './shutdown';

/**
 * Real loader kept behind the seam so tests inject a double instead of
 * module-mocking: the dynamic import stays native in the shipped CLI.
 * The cast narrows chokidar's overloaded `on`/`off` to the structural
 * `WatcherLike` shape; the two are not assignable as written.
 */
function importChokidar(): Promise<ChokidarLike> {
  return import('chokidar') as unknown as Promise<ChokidarLike>;
}

/**
 * A failed initial run does NOT prevent the loop from starting - the
 * whole point of watch mode is fixing the input and re-emitting.
 */
async function runWatchLoop({
  inputFile,
  onChange,
  initialExit,
  loadChokidar,
}: RunWatchLoopArgs): Promise<number> {
  let chokidar: ChokidarLike;
  try {
    chokidar = await (loadChokidar ?? importChokidar)();
  } catch (error: unknown) {
    throw new IoError(`watch: cannot load "chokidar": ${stringifyError(error)}`);
  }
  const inputDirectory = dirname(resolve(inputFile));
  const watcher = chokidar.watch(inputDirectory, {
    ignored: makeIgnoredPredicate(inputFile),
    persistent: true,
    ignoreInitial: true,
    depth: 0,
  });
  let lastExit = initialExit;
  const regenerate = createDebouncer({
    run: () => {
      lastExit = onChange();
    },
  });
  const fileEvents = ['add', 'change', 'unlink'];
  for (const event of fileEvents) watcher.on(event, regenerate.trigger);
  const reattach = createReattacher({
    watcher,
    inputDirectory,
    onReattached: regenerate.trigger,
  });
  const onRootRemoved = makeRootRemovedHandler({
    inputDirectory,
    onRemoved: () => {
      /** The removal is a change like any other; the wait for its return runs alongside. */
      regenerate.trigger();
      reattach.start();
    },
  });
  watcher.on('unlinkDir', onRootRemoved);
  const stopRegenerating = (): void => {
    regenerate.cancel();
    reattach.stop();
    for (const event of fileEvents) watcher.off(event, regenerate.trigger);
    watcher.off('unlinkDir', onRootRemoved);
  };
  await waitForShutdown({ watcher, onShutdown: stopRegenerating });
  return lastExit;
}

/**
 * Which removed directory is this loop's business: only the watched root
 * takes the watch with it. A removed sub-directory is an ordinary change
 * the file events already cover.
 */
function makeRootRemovedHandler({
  inputDirectory,
  onRemoved,
}: MakeRootRemovedHandlerArgs): (...eventArgs: unknown[]) => void {
  const resolvedRoot = resolve(inputDirectory);
  return (...eventArgs: unknown[]): void => {
    const removedPath = eventArgs[0];
    if (typeof removedPath !== 'string' || resolve(removedPath) !== resolvedRoot) return;
    onRemoved();
  };
}

export { runWatchLoop };
