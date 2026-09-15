/**
 * What `runWatchLoop` reports when it cannot do its job: no change ever
 * arrives, the watcher itself errors, or the module it needs will not
 * load. Each answer is an exit code or an error class a caller acts on,
 * so each is pinned rather than left to the shape of a stack trace.
 */

import { IoError } from '../../shared/errors';
import { runWatchLoop } from '../watchLoop';

import { LOOP_ARGS, emitSignal, makeFakeWatcher, tick } from './helpers/doubles';

/** The loop only passes exit codes through; any two distinct numbers prove that. */
const RUN_OK = 0;
const RUN_FAILED = 1;

describe('runWatchLoop: failures', () => {
  it('returns the initial exit when no change ever fires', async () => {
    const { chokidar } = makeFakeWatcher();
    const loop = runWatchLoop({
      ...LOOP_ARGS,
      onChange: jest.fn(() => RUN_OK),
      initialExit: RUN_FAILED,
      loadChokidar: () => Promise.resolve(chokidar),
    });
    await tick();
    emitSignal('SIGTERM');
    await expect(loop).resolves.toBe(RUN_FAILED);
  });

  it('rejects with the watcher error; a rejecting close() leaves no unhandled rejection', async () => {
    const { chokidar, fire } = makeFakeWatcher(() => Promise.reject(new Error('close boom')));
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const boom = new Error('EACCES: permission denied');
      const loop = runWatchLoop({
        ...LOOP_ARGS,
        onChange: jest.fn(() => RUN_OK),
        initialExit: RUN_OK,
        loadChokidar: () => Promise.resolve(chokidar),
      });
      await tick();
      fire('error', boom);
      await expect(loop).rejects.toBe(boom);
      await tick();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    expect(unhandled).toEqual([]);
  });

  it('throws IoError when the loader fails, so the CLI reports it as I/O', async () => {
    await expect(
      runWatchLoop({
        ...LOOP_ARGS,
        onChange: jest.fn(() => RUN_OK),
        initialExit: RUN_OK,
        loadChokidar: () => Promise.reject(new Error('not installed')),
      }),
    ).rejects.toThrow(IoError);
  });
});
