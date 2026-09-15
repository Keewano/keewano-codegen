/**
 * `edit` changes the name in place and leaves everything that identifies
 * the event on the wire alone: the entry keeps its position, so its id,
 * and its payload type.
 */

import { readFileSync } from 'node:fs';

import {
  definitionsFileIn,
  writeDefinitionsFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

const directory = useTempDirectory('keewano-codegen-edit-');
const file = (): string => definitionsFileIn(directory());
const text = (): string => readFileSync(file(), 'utf8');
const definitions = (): unknown => JSON.parse(text());

describe('cli.run: edit', () => {
  /**
   * The id is what recorded data was written under and the payload type
   * is what that data holds, so a rename that moved either would
   * reinterpret history rather than relabel it.
   */
  it('renames the event in place, keeping its position and payload type', async () => {
    writeDefinitionsFile({
      file: file(),
      events: [
        { name: 'Tap', type: 0 },
        { name: 'LevelUp', type: 2 },
        { name: 'Last', type: 1 },
      ],
    });
    const { exit, stdout } = await runCli([
      'edit',
      'LevelUp',
      '--rename',
      'PlayerLeveledUp',
      '--input',
      file(),
    ]);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(stdout).toMatch(/renamed LevelUp to PlayerLeveledUp .* \(id 2501 unchanged\)/);
    expect(definitions()).toEqual({
      events: [
        { eventName: 'Tap', eventValueType: 'none' },
        { eventName: 'PlayerLeveledUp', eventValueType: 'uint' },
        { eventName: 'Last', eventValueType: 'string' },
      ],
    });
  });

  it('refuses a rename to the name the event already has', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    const before = text();
    const { exit, stderr } = await runCli(['edit', 'Tap', '--rename', 'Tap', '--input', file()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/already its name/);
    expect(text()).toBe(before);
  });

  it('refuses a rename to a name another event holds', async () => {
    writeDefinitionsFile({
      file: file(),
      events: [
        { name: 'Tap', type: 0 },
        { name: 'Swipe', type: 0 },
      ],
    });
    const before = text();
    const { exit, stderr } = await runCli(['edit', 'Tap', '--rename', 'Swipe', '--input', file()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/"Swipe" is already defined/);
    expect(text()).toBe(before);
  });

  it('refuses an event the set does not have', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    const { exit, stderr } = await runCli([
      'edit',
      'Missing',
      '--rename',
      'Other',
      '--input',
      file(),
    ]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/no event named "Missing"/);
  });

  it('refuses a new name that collides only after a target transforms it', async () => {
    writeDefinitionsFile({
      file: file(),
      events: [
        { name: 'LevelUp', type: 0 },
        { name: 'Tap', type: 0 },
      ],
    });
    const { exit, stderr } = await runCli([
      'edit',
      'Tap',
      '--rename',
      'Level_Up',
      '--input',
      file(),
    ]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/both emit report_level_up/);
  });

  it('drops the renamed entry itself from the collision check', async () => {
    /**
     * `Level_Up` and `LevelUp` are one `report_level_up` under python, and
     * the only holder of that spelling is the entry being renamed. Without
     * the own-entry exclusion the rename would be refused as a collision
     * with itself.
     */
    writeDefinitionsFile({ file: file(), events: [{ name: 'Level_Up', type: 0 }] });
    const { exit } = await runCli(['edit', 'Level_Up', '--rename', 'LevelUp', '--input', file()]);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(definitions()).toEqual({
      events: [{ eventName: 'LevelUp', eventValueType: 'none' }],
    });
  });

  it('requires the flag that says what to rename to', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    const { exit, stderr } = await runCli(['edit', 'Tap', '--input', file()]);
    expect(exit).toBe(EXIT_CODES.VALIDATION);
    expect(stderr).toMatch(/edit requires --rename/);
  });
});
