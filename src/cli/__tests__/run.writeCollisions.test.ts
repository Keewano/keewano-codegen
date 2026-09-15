/**
 * Two artifacts of one run aimed at one file. Every artifact carries
 * the generator's own name and the names differ, so on a plain tree
 * they cannot collide - but a link makes two names one file, and then
 * whichever is written last wins while the loser is missed rather than
 * reported: an Android app whose asset was replaced by the manifest
 * simply has no custom events. Checked through the real CLI, because
 * when the refusal fires is part of what a user sees.
 */

import { existsSync, linkSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  definitionsFileIn,
  writeDefinitionsFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

const directory = useTempDirectory('keewano-codegen-write-collisions-');
const file = (): string => definitionsFileIn(directory());

describe('cli.run write collisions', () => {
  it('refuses the asset and the manifest when a link makes them one file', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Alpha', type: 0 }] });
    const build = join(directory(), 'build');
    mkdirSync(build);
    const asset = join(build, 'keewano_custom_events.json');
    writeFileSync(asset, '{}', 'utf8');
    linkSync(asset, join(build, 'keewano-events.json'));

    const { exit, stderr } = await runCli([
      '--input',
      file(),
      '--target',
      'kotlin',
      '--code',
      build,
      '--asset',
      build,
      '--json',
    ]);

    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/--asset and --json write the same file/);
    expect(existsSync(join(build, 'KeewanoCustomEvents.Generated.kt'))).toBe(false);
  });

  it('writes them side by side when they are two files', async () => {
    /** The same directory for everything is the ordinary layout, not a collision. */
    writeDefinitionsFile({ file: file(), events: [{ name: 'Alpha', type: 0 }] });
    const build = join(directory(), 'build');

    const { exit } = await runCli([
      '--input',
      file(),
      '--target',
      'kotlin',
      '--code',
      build,
      '--asset',
      build,
      '--json',
    ]);

    expect(exit).toBe(EXIT_CODES.OK);
    for (const name of [
      'KeewanoCustomEvents.Generated.kt',
      'keewano_custom_events.json',
      'keewano-events.json',
    ]) {
      expect(existsSync(join(build, name))).toBe(true);
    }
  });
});
