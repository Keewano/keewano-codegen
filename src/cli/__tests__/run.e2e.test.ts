/**
 * End-to-end orchestrator tests: feed a definitions file through
 * `run(...)`, assert the generated file appears under the name the
 * target gives it, the exit code maps to the documented contract, the
 * idempotency check skips a no-op second pass, and `--target` reaches
 * the emitter. Meta-flag tests live in `run.meta.test.ts`.
 */

import type { EmitTarget } from '../../emitters/types/emit';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEFAULT_TARGET,
  TARGET_NAMES,
  assetFileNameFor,
  generatedFileNameFor,
} from '../../emitters/registry';
import {
  DEFINITIONS_FILE_NAME,
  definitionsFileIn,
  writeDefinitionsFile,
} from '../../events/__tests__/helpers/definitionsFile';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { runCli } from './helpers/runCli';

/**
 * How each target names the SDK it writes against - enough to tell one
 * emitter output from another; the full per-target text is pinned by the
 * per-language suites. The native targets do not spell an import the way
 * a module specifier does, which is the point of listing them here.
 */
const IMPORT_BY_TARGET = {
  'react-native': "from '@keewano/react-native-sdk'",
  expo: "from '@keewano/react-native-expo-sdk'",
  node: "from '@keewano/node-sdk'",
  web: "from '@keewano/web-sdk'",
  swift: 'import KeewanoSDK',
  python: 'from keewano_sdk import',
  kotlin: 'import com.keewano.sdk.KeewanoSDK',
} as const;

describe('cli.run: end-to-end against a definitions file', () => {
  const directory = useTempDirectory('keewano-codegen-cli-');
  const file = (): string => definitionsFileIn(directory());
  const code = (): string => join(directory(), 'gen');

  /** The flags one target needs: the asset directory too, where the target writes one. */
  const argvFor = (target: EmitTarget): string[] => [
    '--input',
    file(),
    '--target',
    target,
    '--code',
    code(),
    ...(assetFileNameFor(target) === undefined ? [] : ['--asset', join(directory(), 'assets')]),
  ];

  it('writes the generated file and exits 0 on a clean input set', async () => {
    writeDefinitionsFile({
      file: file(),
      events: [
        { name: 'GameStart', type: 0 },
        { name: 'BestScore', type: 2 },
      ],
    });
    const { exit, stdout } = await runCli(['--input', file(), '--code', code()]);
    expect(exit).toBe(EXIT_CODES.OK);
    const source = readFileSync(join(code(), generatedFileNameFor(DEFAULT_TARGET)), 'utf8');
    expect(source).toMatch(/reportBestScore\(value: number\): void/);
    expect(source).toMatch(/reportGameStart\(\): void/);
    expect(stdout).toMatch(/wrote .* \(2 events\)/);
  });

  it('is idempotent on a second run when input has not changed', async () => {
    writeDefinitionsFile({ file: file(), events: [{ name: 'Tap', type: 0 }] });
    const outputPath = join(code(), generatedFileNameFor(DEFAULT_TARGET));
    await runCli(['--input', file(), '--code', code()]);
    const before = readFileSync(outputPath, 'utf8');
    const second = await runCli(['--input', file(), '--code', code()]);
    expect(second.exit).toBe(EXIT_CODES.OK);
    expect(second.stdout).toMatch(/up to date/);
    expect(readFileSync(outputPath, 'utf8')).toBe(before);
  });

  it('reads ./keewano.events.json when --input is omitted', async () => {
    /** The working directory is the temp directory, so the default resolves inside it. */
    writeDefinitionsFile({
      file: join(process.cwd(), DEFINITIONS_FILE_NAME),
      events: [{ name: 'Tap', type: 0 }],
    });
    const { exit } = await runCli(['--code', code()]);
    expect(exit).toBe(EXIT_CODES.OK);
    expect(existsSync(join(code(), generatedFileNameFor(DEFAULT_TARGET)))).toBe(true);
  });

  it.each(TARGET_NAMES)('reaches the %s emitter through --target', async (target) => {
    /**
     * The file name comes from the registry, as the CLI itself names it:
     * the caller passes only the directory.
     */
    writeDefinitionsFile({ file: file(), events: [{ name: 'Score', type: 2 }] });

    const { exit } = await runCli(argvFor(target));

    expect(exit).toBe(EXIT_CODES.OK);
    expect(readFileSync(join(code(), generatedFileNameFor(target)), 'utf8')).toContain(
      IMPORT_BY_TARGET[target],
    );
  });

  it('writes the kotlin definition-set asset the SDK reads at launch, and rewrites nothing on a second pass', async () => {
    /**
     * Android is the one target that does not carry the set inside the
     * generated source: the SDK reads it from an asset at launch, so a
     * run that emits the reporters and no asset produces an app whose
     * custom events are all unknown to the backend.
     */
    writeDefinitionsFile({ file: file(), events: [{ name: 'Score', type: 2 }] });
    const assetPath = join(directory(), 'assets', 'keewano_custom_events.json');
    const argv = argvFor('kotlin');

    expect((await runCli(argv)).exit).toBe(EXIT_CODES.OK);
    const asset: unknown = JSON.parse(readFileSync(assetPath, 'utf8'));
    expect(asset).toEqual({
      version: expect.any(Number) as number,
      eventCount: 1,
      gzipBase64: expect.any(String) as string,
    });

    const second = await runCli(argv);
    expect(second.stdout).toContain('keewano_custom_events.json up to date');
    expect(readFileSync(assetPath, 'utf8').trimEnd()).toBe(JSON.stringify(asset, null, 2));
  });

  it('generates every target in turn from one definitions file into one directory', async () => {
    /** Every target names its own file, so one directory holds them all without one overwriting another. */
    writeDefinitionsFile({ file: file(), events: [{ name: 'Score', type: 2 }] });
    for (const target of TARGET_NAMES) {
      const { exit, stderr } = await runCli(argvFor(target));
      expect([target, exit, stderr]).toEqual([target, EXIT_CODES.OK, '']);
    }
    const written = new Set(TARGET_NAMES.map((target) => generatedFileNameFor(target)));
    for (const name of written) expect(existsSync(join(code(), name))).toBe(true);
    expect(existsSync(join(directory(), 'assets', 'keewano_custom_events.json'))).toBe(true);
  });
});
