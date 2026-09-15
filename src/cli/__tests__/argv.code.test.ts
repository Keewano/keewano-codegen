/**
 * Where the generated file goes. The caller names the directory and the
 * target names the file, because the SDK that imports it looks for that
 * name. Every rule here is a promise to somebody's build script: a
 * default that guessed wrong wrote a file the toolchain never picked up
 * and reported success doing it. The meta flags have to answer regardless.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { TARGET_NAMES, assetFileNameFor, generatedFileNameFor } from '../../emitters/registry';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { ParseError } from '../../shared/errors';
import { parseArgv } from '../argv';
import { CLI_DEFAULTS } from '../defaults';

const directory = useTempDirectory('keewano-codegen-argv-code-');

describe('parseArgv code rules', () => {
  it.each(TARGET_NAMES)('refuses %s without --code', (target) => {
    expect(() => parseArgv(['--target', target])).toThrow(ParseError);
    expect(() => parseArgv(['--target', target])).toThrow(/--code <dir> is required/);
  });

  it.each(TARGET_NAMES)(
    'puts the %s file under --code with the name the target gives it',
    (target) => {
      const code = join(directory(), 'gen');
      const asset =
        assetFileNameFor(target) === undefined ? [] : ['--asset', join(directory(), 'a')];
      expect(parseArgv(['--target', target, '--code', code, ...asset]).output).toBe(
        join(code, generatedFileNameFor(target)),
      );
    },
  );

  it.each([
    ['kotlin', 'Generated.kt'],
    ['web', 'gen.ts'],
    ['python', 'events.py'],
  ])('refuses --code ending in the file the %s target would write there', (target, name) => {
    /**
     * The habit every earlier invocation built. Taken as a directory it
     * would create a folder called `Generated.kt` with the file inside,
     * and the build that looked for `Generated.kt` would find a directory.
     */
    const asset = target === 'kotlin' ? ['--asset', join(directory(), 'a')] : [];
    expect(() =>
      parseArgv(['--target', target, '--code', join(directory(), name), ...asset]),
    ).toThrow(/--code takes a directory/);
  });

  it('accepts a directory whose name merely contains a dot', () => {
    /** `v1.2` is a directory; only the extension the generator itself would write is the habit. */
    const code = join(directory(), 'v1.2');
    expect(parseArgv(['--target', 'web', '--code', code]).output).toBe(
      join(code, 'keewano-events.generated.ts'),
    );
  });

  it('recognises the habit by any extension the generator writes, whatever the target', () => {
    /**
     * A kotlin-shaped path carried into a settings file and run with
     * `--target python`: `.kt` is not `.py`, but it is still a file name,
     * and taken as a directory it would become one.
     */
    expect(() =>
      parseArgv(['--target', 'python', '--code', join(directory(), 'Generated.kt')]),
    ).toThrow(/--code takes a directory/);
  });

  it('names the settings key rather than a flag when the directory came from the settings file', () => {
    /** The reader would otherwise search their command line for a --code they never typed. */
    writeFileSync(
      join(directory(), CLI_DEFAULTS.CONFIG_FILE_NAME),
      JSON.stringify({ code: 'src/gen.ts' }),
    );
    expect(() => parseArgv(['--target', 'web'])).toThrow(
      /"code" in .*keewano\.codegen\.json takes a directory/,
    );
  });

  it('refuses --output by name, pointing at the flag that replaced it', () => {
    /** Refused as unknown, the reader would hunt for a typo in a flag that used to work. */
    expect(() => parseArgv(['--target', 'web', '--output', join(directory(), 'gen.ts')])).toThrow(
      /--output was replaced by --code/,
    );
  });
});

describe('parseArgv meta flags', () => {
  it.each([
    ['kotlin', '--help'],
    ['kotlin', '--version'],
    ['swift', '--help'],
    ['swift', '--version'],
  ])('answers %s %s without asking for --code', (target, flag) => {
    /**
     * A meta run prints and exits without writing, so refusing it over
     * a missing directory withholds the page that says which flag names
     * it. The same rule already covers a broken settings file.
     */
    const args = parseArgv(['--target', target, flag]);
    expect(args.asset).toBeUndefined();
    expect(flag === '--help' ? args.help : args.version).toBe(true);
  });

  it('answers --help for a target whose --asset would be refused', () => {
    expect(() =>
      parseArgv(['--target', 'web', '--asset', join(directory(), 'a'), '--help']),
    ).not.toThrow();
  });
});
