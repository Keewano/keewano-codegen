/**
 * Debouncing inside `runWatchLoop`: a burst of file events becomes
 * one regeneration, and a pending run is dropped on shutdown.
 */

import { runWatchLoop } from '../watchLoop';

/** The loop only passes exit codes through; any two distinct numbers prove that. */
const RUN_OK = 0;
const RUN_FAILED = 1;

import { LOOP_ARGS, emitSignal, makeFakeWatcher, tick, waitPastDebounce } from './helpers/doubles';

describe('runWatchLoop: debounce', () => {
  let stdoutSpy: jest.SpyInstance;
  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('debounces a burst of changes into one regeneration', async () => {
    /**
     * An editor save often fires add+change within milliseconds; running
     * the generator once per event would race the writes against each
     * other and print N results for one save.
     */
    const { chokidar, fire } = makeFakeWatcher();
    const onChange = jest.fn(() => RUN_OK);
    const loop = runWatchLoop({
      ...LOOP_ARGS,
      onChange,
      initialExit: RUN_OK,
      loadChokidar: () => Promise.resolve(chokidar),
    });
    await tick();
    fire('add');
    fire('change');
    fire('unlink');
    await waitPastDebounce();
    emitSignal('SIGTERM');
    await expect(loop).resolves.toBe(RUN_OK);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending debounced run when the loop shuts down first', async () => {
    /** A save right before Ctrl-C must not run the generator after the loop resolved. */
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
    emitSignal('SIGINT');
    await expect(loop).resolves.toBe(RUN_FAILED);
    await waitPastDebounce();
    expect(onChange).not.toHaveBeenCalled();
  });
});
