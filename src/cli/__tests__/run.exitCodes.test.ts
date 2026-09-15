/**
 * The exit-code contract of `run()` on the `--watch` branch, routed
 * through the real CLI rather than `runWatchLoop` in isolation.
 */

import { join } from 'node:path';

import {
  definitionsFileIn,
  writeDefinitionsFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

const directory = useTempDirectory('keewano-codegen-exit-');

describe('cli.run --watch', () => {
  it('exits IO when the watcher module cannot be loaded, after the initial generation ran', async () => {
    /**
     * jest's CommonJS runtime cannot execute the loop's native dynamic
     * `import('chokidar')`, which is exactly the "watcher unavailable"
     * failure a broken install would produce; the CLI must map it to
     * the documented IO code rather than crash with a stack.
     */
    const file = definitionsFileIn(directory());
    writeDefinitionsFile({ file, events: [{ name: 'Tap', type: 0 }] });
    const { exit, stdout, stderr } = await runCli([
      '--input',
      file,
      '--code',
      join(directory(), 'gen'),
      '--watch',
    ]);
    expect(exit).toBe(EXIT_CODES.IO);
    expect(stdout).toMatch(/wrote .* \(1 events\)/);
    expect(stdout).toMatch(/watching .*keewano\.events\.json/);
    expect(stderr).toMatch(/cannot load "chokidar"/);
  });
});
