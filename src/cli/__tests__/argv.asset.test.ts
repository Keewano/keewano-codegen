/**
 * Where the definition-set asset lands. The caller names the directory
 * and the SDK's own lookup name completes the path; a target with no
 * asset refuses the flag rather than ignoring it, and the one target
 * with an asset refuses to run without a directory for it.
 */

import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { ParseError } from '../../shared/errors';
import { parseArgv } from '../argv';
import { CLI_DEFAULTS } from '../defaults';

const directory = useTempDirectory('keewano-codegen-argv-asset-');

/** The name the Android SDK looks the set up under; the flag names only the directory. */
const ASSET_FILE_NAME = 'keewano_custom_events.json';

describe('parseArgv asset rules', () => {
  it.each(['swift', 'web', 'node'])('refuses --asset for %s, which emits none', (target) => {
    /** A typed flag that does nothing hides a mistake: the caller believes an asset was written. */
    expect(() =>
      parseArgv(['--target', target, '--code', directory(), '--asset', join(directory(), 'a')]),
    ).toThrow(/emits no asset/);
    expect(parseArgv(['--target', target, '--code', directory()]).asset).toBeUndefined();
  });

  it('requires --asset for kotlin, whose SDK reads the set from a file at launch', () => {
    /**
     * Defaulted, the asset landed where no build packaged it and the run
     * reported success; the SDK then knew no custom event at all.
     */
    const argv = ['--target', 'kotlin', '--code', directory()];
    expect(() => parseArgv(argv)).toThrow(ParseError);
    expect(() => parseArgv(argv)).toThrow(/needs --asset <dir>; the file is named/);
  });

  it('completes --asset with the name the SDK looks the file up under', () => {
    const assets = join(directory(), 'src', 'main', 'assets');
    const { asset } = parseArgv(['--target', 'kotlin', '--code', directory(), '--asset', assets]);
    expect(asset).toBe(join(assets, ASSET_FILE_NAME));
  });

  it('refuses an --asset that names a file, the habit every earlier invocation built', () => {
    /** Taken as a directory it would create a folder called `set.json` with the asset inside. */
    expect(() =>
      parseArgv([
        '--target',
        'kotlin',
        '--code',
        directory(),
        '--asset',
        join(directory(), 'set.json'),
      ]),
    ).toThrow(/--asset takes a directory/);
  });

  it('takes the asset directory from the settings file, and lets the flag beat it', () => {
    writeFileSync(
      join(directory(), CLI_DEFAULTS.CONFIG_FILE_NAME),
      JSON.stringify({ asset: 'from-config' }),
    );
    expect(parseArgv(['--target', 'kotlin', '--code', directory()]).asset).toBe(
      resolve(directory(), 'from-config', ASSET_FILE_NAME),
    );
    const typed = join(directory(), 'typed');
    expect(parseArgv(['--target', 'kotlin', '--code', directory(), '--asset', typed]).asset).toBe(
      join(typed, ASSET_FILE_NAME),
    );
  });

  it('ignores a configured asset directory for a target that emits none', () => {
    /** A committed settings file is ambient: one repository generates for several targets from it. */
    writeFileSync(
      join(directory(), CLI_DEFAULTS.CONFIG_FILE_NAME),
      JSON.stringify({ asset: 'from-config' }),
    );
    expect(parseArgv(['--target', 'web', '--code', directory()]).asset).toBeUndefined();
  });
});
