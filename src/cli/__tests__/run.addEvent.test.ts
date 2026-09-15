/**
 * `add` appends the entry a developer would otherwise write by hand,
 * which is the whole reason it exists: the file's shape is this tool's
 * vocabulary, and the position - which is the id - is the one thing a
 * hand edit gets wrong without noticing. What it refuses is
 * `run.addEvent.refusals.test.ts`.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  definitionsFileIn,
  writeDefinitionsFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

const directory = useTempDirectory('keewano-codegen-add-');
const file = (): string => definitionsFileIn(directory());
const text = (): string => readFileSync(file(), 'utf8');
const definitions = (): unknown => JSON.parse(text());

describe('cli.run: add', () => {
  it('creates the file on the first add and writes the entry a hand edit would have', async () => {
    expect(existsSync(file())).toBe(false);
    const { exit, stdout } = await runCli([
      'add',
      'EnemyKilled',
      '--type',
      'string',
      '--input',
      file(),
    ]);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(stdout).toMatch(/added EnemyKilled as id 2500/);
    expect(definitions()).toEqual({
      events: [{ eventName: 'EnemyKilled', eventValueType: 'string' }],
    });
  });

  it('appends, so the new event takes the id after the last one', async () => {
    /** An id is a position; the end is the one place an entry can go without moving another. */
    writeDefinitionsFile({
      file: file(),
      events: [
        { name: 'First', type: 0 },
        { name: 'Later', type: 0 },
      ],
    });
    const { stdout } = await runCli(['add', 'Newest', '--type', 'bool', '--input', file()]);
    expect(stdout).toMatch(/added Newest as id 2502/);
    expect(definitions()).toEqual({
      events: [
        { eventName: 'First', eventValueType: 'none' },
        { eventName: 'Later', eventValueType: 'none' },
        { eventName: 'Newest', eventValueType: 'bool' },
      ],
    });
  });

  it('writes one fixed layout, so a second add changes only the entry it added', async () => {
    /** A hand-laid-out file is reformatted once; from then on the diff of an add is its own entry. */
    writeFileSync(file(), '{"events":[{"eventName":"Tap","eventValueType":"none"}]}', 'utf8');
    await runCli(['add', 'Swipe', '--type', 'none', '--input', file()]);
    const once = text();
    expect(once).toBe(`${JSON.stringify(definitions(), undefined, 2)}\n`);
    await runCli(['add', 'Hold', '--type', 'none', '--input', file()]);
    expect(text().split('\n').length - once.split('\n').length).toBe(4);
  });

  /**
   * Two events already in the file can collide under a target the project
   * does not generate for, and that set builds. Judging the whole set
   * here would refuse an unrelated event over those two, naming neither
   * the command nor anything the caller can act on; what the set owes
   * every target is the generate path's question.
   */
  it('adds beside a collision the set already carries', async () => {
    writeDefinitionsFile({
      file: file(),
      events: [
        { name: 'LevelUp', type: 0 },
        { name: 'Level_Up', type: 0 },
      ],
    });
    const { exit, stdout } = await runCli([
      'add',
      'Unrelated',
      '--type',
      'none',
      '--input',
      file(),
    ]);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(stdout).toMatch(/added Unrelated as id 2502/);
  });

  it('writes a file the generate path accepts unedited', async () => {
    await runCli(['add', 'Purchase', '--type', 'price_usd_cent', '--input', file()]);
    const code = join(directory(), 'gen');
    const { exit, stdout } = await runCli([
      '--input',
      file(),
      '--target',
      'python',
      '--code',
      code,
    ]);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(stdout).toMatch(/1 events/);
    expect(readFileSync(join(code, 'keewano_custom_events.py'), 'utf8')).toMatch(
      /def report_purchase\(/,
    );
  });
});
