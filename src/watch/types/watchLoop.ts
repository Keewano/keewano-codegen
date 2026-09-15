/**
 * The watcher the loop drives, kept as a structural contract so tests
 * can double it without the real chokidar.
 */

/**
 * Options the loop passes to `watch()`.
 *
 * ignored - Predicate filtering entries out of the watch.
 * persistent - Keep the process alive while watching.
 * ignoreInitial - Suppress events for pre-existing files.
 * depth - How many levels below the root are traversed. Zero: with the
 *   default input the root is the project root, and a recursive watch
 *   there would deliver every write under node_modules and the build
 *   output to the predicate.
 */
interface WatchOptions {
  ignored: (testPath: string) => boolean;
  persistent: boolean;
  ignoreInitial: boolean;
  depth: number;
}

/**
 * Event surface the loop uses from a watcher instance. `on`/`off` carry
 * `add`/`change`/`unlink`/`unlinkDir`/`error`; `watch` puts a path back
 * under watch after its directory was removed; `close` resolves when the
 * watcher released its handles.
 */
interface WatcherLike {
  on(event: string, listener: (...eventArgs: unknown[]) => void): WatcherLike;
  off(event: string, listener: (...eventArgs: unknown[]) => void): WatcherLike;
  add(paths: string): void;
  close(): Promise<void>;
}

/**
 * Arguments of `makeRootRemovedHandler`.
 *
 * inputDirectory - the watched root; other removed directories are not
 *   this loop's business.
 * onRemoved - called when that root is the one that disappeared.
 */
interface MakeRootRemovedHandlerArgs {
  inputDirectory: string;
  onRemoved: () => void;
}

/** The module shape the loop needs from chokidar: a `watch()` factory. */
interface ChokidarLike {
  watch(root: string, options: WatchOptions): WatcherLike;
}

/**
 * Arguments of `runWatchLoop`. The loop knows nothing about what a run
 * is: it watches the definitions file and calls back.
 *
 * inputFile - the definitions file. Its directory is what goes under
 *   watch, with everything but the file ignored; see ignore.ts for why.
 * onChange - re-run callback; returns the run's exit code.
 * initialExit - exit code of the run performed before the loop started;
 *   returned when no change ever fires.
 * loadChokidar - loader seam for the watcher module. Defaults to the
 *   real dynamic import; tests inject a double here.
 */
interface RunWatchLoopArgs {
  inputFile: string;
  onChange: () => number;
  initialExit: number;
  loadChokidar?: () => Promise<ChokidarLike>;
}

export type {
  ChokidarLike,
  MakeRootRemovedHandlerArgs,
  RunWatchLoopArgs,
  WatchOptions,
  WatcherLike,
};
