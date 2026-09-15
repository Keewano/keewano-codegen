/**
 * What the usage page says. It is read off the same tables the CLI
 * runs on - the registry for the targets and their file names, the type
 * tables for the payload types - so a target or a type added there
 * cannot be missing here.
 */

import type { CustomEventTypeValue } from '../../events/customEventType';

import { DEFAULT_TARGET, TARGET_NAMES, generatedFileNameFor } from '../../emitters/registry';
import {
  CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE,
  CUSTOM_EVENT_TYPE_NAME_BY_TYPE,
} from '../../events/customEventType';
import { EXIT_CODES } from '../exitCode';
import { USAGE } from '../usage';

import { runCli } from './helpers/runCli';

describe('cli.run: the usage page', () => {
  it('prints usage and exits 0 on --help, naming every target', async () => {
    const { exit, stdout } = await runCli(['--help']);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(stdout).toMatch(/Usage: keewano-codegen/);
    /** The option's own line, not the synopsis that also names the flag. */
    const targetLine = stdout.split('\n').find((line) => line.startsWith('  --target'));
    expect(targetLine).toBeDefined();
    for (const name of TARGET_NAMES) {
      expect(targetLine).toContain(name);
    }
    expect(targetLine).toContain(`${DEFAULT_TARGET} (default)`);
  });

  it('lists every payload type by its wire name, beside the name the generated header prints', () => {
    /**
     * The wire name is what the file and `add --type` take; the human
     * name is what the generated file's header prints beside each
     * event, so a reader can match the two.
     */
    const entries = Object.entries(CUSTOM_EVENT_TYPE_NAME_BY_TYPE);

    expect(entries.length).toBeGreaterThan(0);
    for (const [tag, name] of entries) {
      const wire = CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE[Number(tag) as CustomEventTypeValue];
      expect(USAGE).toMatch(new RegExp(`^  ${wire}\\s+${name}$`, 'm'));
    }
  });

  it('lists the file every target generates, so nobody has to guess the name', () => {
    for (const target of TARGET_NAMES) {
      expect(USAGE).toMatch(new RegExp(`^  ${target}\\s+${generatedFileNameFor(target)}`, 'm'));
    }
  });

  it('says how ids are assigned, since the file itself carries none', () => {
    expect(USAGE).toMatch(/id is 2500 plus its position/);
  });

  /**
   * The commands take none of the generate path's flags, so `--help` was
   * refused as one of those - a refusal at the one moment somebody is
   * asking how to use the thing.
   */
  it.each(['add', 'edit', 'remove'])('prints the usage for %s --help', async (command) => {
    const { exit, stdout } = await runCli([command, '--help']);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(stdout).toMatch(/Usage: keewano-codegen/);
  });
});
