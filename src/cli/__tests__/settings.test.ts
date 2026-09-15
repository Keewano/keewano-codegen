/**
 * The project config file and its priority against flags. A typo in
 * the file must fail loudly, an absent file must be silent, and a typed
 * flag must always beat the file - otherwise a one-off override does
 * nothing and the user cannot tell why.
 */

import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { makeTempDir, useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { ParseError } from '../../shared/errors';
import { parseArgv } from '../argv';
import { CLI_DEFAULTS } from '../defaults';
import { loadConfig } from '../settings';

const directory = useTempDirectory('keewano-codegen-config-');

const writeConfig = (body: unknown): string => {
  const path = join(directory(), CLI_DEFAULTS.CONFIG_FILE_NAME);
  writeFileSync(path, typeof body === 'string' ? body : JSON.stringify(body));
  return path;
};

describe('loadConfig', () => {
  it('returns undefined when no config file exists', () => {
    expect(loadConfig({ path: join(directory(), CLI_DEFAULTS.CONFIG_FILE_NAME) })).toBeUndefined();
  });

  it('resolves relative paths against the config file directory, not cwd', () => {
    const path = writeConfig({ input: 'events.json', code: 'src/gen', asset: 'src/main/assets' });
    process.chdir(tmpdir());
    const config = loadConfig({ path });
    expect(config?.input).toBe(resolve(directory(), 'events.json'));
    expect(config?.code).toBe(resolve(directory(), 'src/gen'));
    expect(config?.asset).toBe(resolve(directory(), 'src/main/assets'));
  });

  it('accepts target and json', () => {
    const path = writeConfig({ target: 'web', json: true });
    expect(loadConfig({ path })).toEqual({ target: 'web', json: true });
  });

  it.each([
    ['an unknown key', { taget: 'web' }, /unknown key "taget"/],
    ['the output key, by name', { output: 'gen.ts' }, /"output" was replaced by "code"/],
    ['a bad target', { target: 'flutter' }, /"target" is not a supported target/],
    ['a non-boolean json', { json: 'yes' }, /"json" must be true or false/],
    ['an empty input', { input: '' }, /"input" must be a non-empty string/],
    ['a JSON array', [1, 2], /expected a JSON object/],
    ['malformed JSON', '{ not json', /malformed JSON/],
  ])('rejects %s with ParseError', (_label, body, pattern) => {
    const path = writeConfig(body);
    expect(() => loadConfig({ path })).toThrow(ParseError);
    expect(() => loadConfig({ path })).toThrow(pattern);
  });
});

describe('parseArgv with a config file', () => {
  it('reads the config from cwd by default and applies it below the flags', () => {
    writeConfig({ input: 'ev.json', code: 'gen', target: 'web', json: true });
    const args = parseArgv([]);
    expect(args.input).toBe(resolve(directory(), 'ev.json'));
    expect(args.target).toBe('web');
    expect(args.json).toBe(true);
    /** The file name is the target's; the config names only the directory. */
    expect(args.output).toBe(resolve(directory(), 'gen', 'keewano-events.generated.ts'));
  });

  it('lets an explicit flag beat the config file', () => {
    writeConfig({ target: 'web', json: true, input: 'from-config.json', code: 'gen' });
    const args = parseArgv(['--target', 'node', '--input', 'from-flag.json']);
    expect(args.target).toBe('node');
    expect(args.input).toBe(resolve(directory(), 'from-flag.json'));
    /** json was not typed as a flag, so the config still supplies it. */
    expect(args.json).toBe(true);
  });

  it('honours --config pointing at a file elsewhere', () => {
    const elsewhere = makeTempDir('keewano-codegen-config-else-');
    try {
      const path = join(elsewhere, 'my.json');
      writeFileSync(path, JSON.stringify({ target: 'expo', code: 'gen' }));
      const args = parseArgv(['--config', path]);
      expect(args.target).toBe('expo');
      expect(args.output).toBe(resolve(elsewhere, 'gen', 'keewano-events.generated.ts'));
    } finally {
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it('surfaces a broken config as ParseError through the argv path', () => {
    writeConfig({ target: 'flutter' });
    expect(() => parseArgv([])).toThrow(ParseError);
  });
});
