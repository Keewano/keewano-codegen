/**
 * `remove` takes an entry out of the set, and every entry after it moves
 * down one id, because an id is a position.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  definitionsFileIn,
  writeDefinitionsFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

const directory = useTempDirectory('keewano-codegen-remove-');
const file = (): string => definitionsFileIn(directory());
const text = (): string => readFileSync(file(), 'utf8');
const names = (): string[] =>
  (JSON.parse(text()) as { events: { eventName: string }[] }).events.map(
    (entry) => entry.eventName,
  );

describe('cli.run: remove', () => {
  it('takes the entry out and says which events moved down one id', async () => {
    writeDefinitionsFile({
      file: file(),
      events: [
        { name: 'Keep', type: 0 },
        { name: 'Drop', type: 0 },
        { name: 'Later', type: 0 },
      ],
    });
    const { exit, stdout } = await runCli(['remove', 'Drop', '--input', file()]);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(stdout).toMatch(/removed Drop \(id 2501\)/);
    expect(stdout).toMatch(/Later moved down one id$/m);
    expect(stdout).not.toMatch(/shipped/);
    expect(names()).toEqual(['Keep', 'Later']);
  });

  it('says nothing about moving when the last entry goes', async () => {
    writeDefinitionsFile({
      file: file(),
      events: [
        { name: 'Keep', type: 0 },
        { name: 'Drop', type: 0 },
      ],
    });
    const { stdout } = await runCli(['remove', 'Drop', '--input', file()]);
    expect(stdout.trim()).toBe('keewano-codegen: removed Drop (id 2501)');
  });

  it('names the ends of the range when many events moved', async () => {
    /** Listing sixty names would bury the point; the count and the ends say it. */
    writeDefinitionsFile({
      file: file(),
      events: ['Drop', 'A', 'B', 'C', 'D', 'E'].map((name) => ({ name, type: 0 })),
    });
    const { stdout } = await runCli(['remove', 'Drop', '--input', file()]);
    expect(stdout).toMatch(/5 events, A to E, moved down one id$/m);
  });

  /**
   * Pinned so it stays a decision rather than a surprise: nothing
   * remembers a removed entry, so the next add takes the position it left.
   */
  it('gives the next add the position the removed entry left', async () => {
    writeDefinitionsFile({
      file: file(),
      events: [
        { name: 'Keep', type: 0 },
        { name: 'Drop', type: 0 },
      ],
    });
    await runCli(['remove', 'Drop', '--input', file()]);
    const { stdout } = await runCli(['add', 'Fresh', '--type', 'none', '--input', file()]);
    expect(stdout).toMatch(/added Fresh as id 2501/);
  });

  it('refuses an event the set does not have and changes nothing', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Keep', type: 0 }] });
    const before = text();
    const { exit, stderr } = await runCli(['remove', 'Missing', '--input', file()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/no event named "Missing"/);
    expect(text()).toBe(before);
  });

  it('refuses a flag it does not take', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Keep', type: 0 }] });
    const before = text();
    const { exit, stderr } = await runCli([
      'remove',
      'Keep',
      '--rename',
      'Other',
      '--input',
      file(),
    ]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/remove does not take "--rename"/);
    expect(text()).toBe(before);
  });

  it('leaves a set that still generates after the last event goes', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Only', type: 0 }] });
    await runCli(['remove', 'Only', '--input', file()]);
    expect(names()).toEqual([]);
    const { exit, stdout } = await runCli([
      '--input',
      file(),
      '--target',
      'web',
      '--code',
      join(directory(), 'gen'),
    ]);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(stdout).toMatch(/0 events/);
  });
});
