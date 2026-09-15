/**
 * `run(...)` with the optional manifest: it appears only on request,
 * carries the generated file's version, and never poisons the next run.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_TARGET, generatedFileNameFor } from '../../emitters/registry';
import {
  definitionsFileIn,
  writeDefinitionsFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { CLI_DEFAULTS } from '../defaults';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

describe('cli.run: --json manifest', () => {
  const directory = useTempDirectory('keewano-codegen-manifest-');
  const file = (): string => definitionsFileIn(directory());

  it('writes keewano-events.json next to the generated file with --json, and not without', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    const code = join(directory(), 'out');
    const outputPath = join(code, generatedFileNameFor(DEFAULT_TARGET));
    const manifestPath = join(code, CLI_DEFAULTS.MANIFEST_FILE_NAME);
    const plain = await runCli(['--input', file(), '--code', code]);
    expect(plain.exit).toBe(EXIT_CODES.OK);
    expect(existsSync(manifestPath)).toBe(false);

    const withJson = await runCli(['--input', file(), '--code', code, '--json']);
    expect(withJson.exit).toBe(EXIT_CODES.OK);
    expect(withJson.stdout).toMatch(/wrote .*keewano-events.json/);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      version: number;
      events: Array<{ id: number; name: string; dataType: string }>;
    };
    expect(manifest.events).toEqual([{ id: 2500, name: 'Tap', type: 0, dataType: 'none' }]);
    /** The manifest and the generated file carry the same version stamp. */
    expect(readFileSync(outputPath, 'utf8')).toContain(
      `version: 0x${manifest.version.toString(16).toUpperCase().padStart(8, '0')}`,
    );
  });

  it('keeps working on the next run when the manifest landed beside the definitions', async () => {
    /**
     * With `--code` pointing at the definitions file's own directory the
     * manifest is written beside it, one `.json` next to another. Nothing
     * but the definitions file is read, so a second run (and every
     * --watch rerun) reports the generated file up to date.
     */
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    const first = await runCli(['--input', file(), '--code', directory(), '--json']);
    expect(first.exit).toBe(EXIT_CODES.OK);
    expect(existsSync(join(directory(), CLI_DEFAULTS.MANIFEST_FILE_NAME))).toBe(true);
    const second = await runCli(['--input', file(), '--code', directory(), '--json']);
    expect(second.exit).toBe(EXIT_CODES.OK);
    expect(second.stdout).toMatch(/up to date \(1 events\)/);
  });
});
