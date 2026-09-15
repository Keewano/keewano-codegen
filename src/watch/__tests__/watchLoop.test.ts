/**
 * The `runWatchLoop` lifecycle through the chokidar loader seam. jest's
 * CommonJS runtime cannot execute the loop's native dynamic import, so
 * a doubled watcher drives the change / error / signal paths
 * deterministically.
 */

import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { DEFINITIONS_FILE_NAME } from '../../events/definitionsDocument';
import { makeTempDir } from '../../shared/__tests__/helpers/tempDirectory';
import { runWatchLoop } from '../watchLoop';

/** The loop only passes exit codes through; any two distinct numbers prove that. */
const RUN_OK = 0;
const RUN_FAILED = 1;

import {
  LOOP_ARGS,
  emitSignal,
  makeFakeWatcher,
  tick,
  waitPastDebounce,
  waitPastReattachPoll,
} from './helpers/doubles';

/** The directory the loop is expected to put under watch for the fixed arguments. */
const WATCHED_ROOT = dirname(resolve(LOOP_ARGS.inputFile));

describe('runWatchLoop (loader seam)', () => {
  let stdoutSpy: jest.SpyInstance;
  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('keeps watching after a failed initial run and reports the recovered exit', async () => {
    const { chokidar, fire } = makeFakeWatcher();
    const onChange = jest.fn(() => RUN_OK);
    const loop = runWatchLoop({
      ...LOOP_ARGS,
      onChange,
      initialExit: RUN_FAILED,
      loadChokidar: () => Promise.resolve(chokidar),
    });
    await tick();
    fire('change');
    /** Let the 100ms debounce fire the re-emit before shutting down. */
    await waitPastDebounce();
    emitSignal('SIGINT');
    await expect(loop).resolves.toBe(RUN_OK);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('watches the directory of the definitions file, one level deep, reacting to that file alone', async () => {
    /**
     * ignore.test.ts proves the predicate; this one proves it is wired
     * into the `watch()` options with the file's own directory as the
     * root and no descent below it, so a generated file written beside
     * the definitions cannot feed the loop back into itself and a
     * project root does not put its whole tree under watch.
     */
    const { chokidar, watchCalls } = makeFakeWatcher();
    const loop = runWatchLoop({
      ...LOOP_ARGS,
      onChange: jest.fn(() => RUN_OK),
      initialExit: RUN_OK,
      loadChokidar: () => Promise.resolve(chokidar),
    });
    await tick();
    const call = watchCalls[0];
    expect(call?.root).toBe(WATCHED_ROOT);
    expect(call?.options.depth).toBe(0);
    expect(call?.options.ignored(join(WATCHED_ROOT, 'keewano-events.generated.ts'))).toBe(true);
    expect(call?.options.ignored(resolve(LOOP_ARGS.inputFile))).toBe(false);
    emitSignal('SIGINT');
    await loop;
  });

  it('waits for the directory of the definitions file to come back and puts the watch on it', async () => {
    /**
     * Checking out another branch removes the folder, and the watch goes
     * with it. Re-adding the path is only possible once it exists again
     * - a checkout that replaces the parent too leaves chokidar nothing
     * to hang the watch on - so the loop waits for it instead of
     * assuming. Without this it stays alive watching nothing, and every
     * later save is silently ignored.
     */
    const directory = makeTempDir('keewano-codegen-watch-gone-');
    rmSync(directory, { recursive: true, force: true });
    const { chokidar, fire, addedPaths } = makeFakeWatcher();
    const onChange = jest.fn(() => RUN_OK);
    const loop = runWatchLoop({
      inputFile: join(directory, DEFINITIONS_FILE_NAME),
      onChange,
      initialExit: RUN_OK,
      loadChokidar: () => Promise.resolve(chokidar),
    });
    await tick();

    fire('unlinkDir', directory);
    await waitPastDebounce();
    /** The removal is reported at once; there is nothing to re-attach to yet. */
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(addedPaths).toEqual([]);

    mkdirSync(directory);
    await waitPastReattachPoll();

    expect(addedPaths).toEqual([directory]);
    expect(onChange).toHaveBeenCalledTimes(2);
    emitSignal('SIGINT');
    await loop;
    rmSync(directory, { recursive: true, force: true });
  });

  it('leaves a removed sub-directory to the ordinary change path', async () => {
    /** Only the root's disappearance takes the watch with it. */
    const { chokidar, fire, addedPaths } = makeFakeWatcher();
    const onChange = jest.fn(() => RUN_OK);
    const loop = runWatchLoop({
      ...LOOP_ARGS,
      onChange,
      initialExit: RUN_OK,
      loadChokidar: () => Promise.resolve(chokidar),
    });
    await tick();

    fire('unlinkDir', join(WATCHED_ROOT, 'nested'));
    await waitPastDebounce();

    expect(onChange).not.toHaveBeenCalled();
    expect(addedPaths).toEqual([]);
    emitSignal('SIGINT');
    await loop;
  });
});
