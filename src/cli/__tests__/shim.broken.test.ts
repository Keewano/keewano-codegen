/**
 * The bin shim when the package around it is not whole: no build, a
 * module that throws while loading, a CLI that throws before it returns
 * a promise. Each has to reach the OS as the internal code with a
 * message that names what happened - the loader's own failure exits 1,
 * which the contract reserves for rejected input, so a CI script would
 * otherwise blame the event definitions for a broken package.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { EXIT_CODES } from '../exitCode';

import { REPO_ROOT, SHIM, planted, runShimAt } from './helpers/shim';

/** Enough of the contract for the shim to read a code off it. */
const EXIT_CODE_MODULE = 'exports.EXIT_CODES = { OK: 0, VALIDATION: 1, IO: 2, INTERNAL: 3 };\n';

describe('the bin shim: a package that is not whole', () => {
  const directory = useTempDirectory('keewano-codegen-shim-broken-');

  it('reports the internal code when the build is not there, not the input code', () => {
    const shim = planted({ root: join(directory(), 'no-build') });

    const { status, stderr } = runShimAt({ shim, args: ['--target', 'web'] });

    expect(status).toBe(EXIT_CODES.INTERNAL);
    expect(stderr).toContain('the compiled CLI is missing');
    expect(stderr).not.toContain('internal/modules/cjs/loader');
  });

  it('spells that code the same way the contract does', () => {
    /**
     * The shim cannot import the constant on the path where it matters,
     * so it carries the number. This is what stops the copy from drifting.
     */
    expect(EXIT_CODES.INTERNAL).toBe(3);
    expect(readFileSync(SHIM, 'utf8')).toContain('const INTERNAL_WITHOUT_THE_BUILD = 3;');
  });

  it('reports the internal code when the CLI throws before returning a promise', () => {
    /**
     * `run` is async today, so a throw inside it is already a rejection.
     * This pins the shim against that changing two modules away: a plain
     * function that throws would otherwise walk past the rejection
     * handler and leave the process reporting success.
     */
    const shim = planted({
      root: join(directory(), 'sync-throw'),
      exitCode: EXIT_CODE_MODULE,
      run: "exports.run = function run() { throw new Error('thrown before a promise exists'); };\n",
    });

    const { status, stderr } = runShimAt({ shim });

    expect(status).toBe(EXIT_CODES.INTERNAL);
    expect(stderr).toContain('thrown before a promise exists');
  });

  it('still reports the internal code when the contract module is truncated', () => {
    /**
     * An interrupted install leaves a zero-byte module. `run.js` still loads,
     * because tsc reads the contract lazily, and the rejection handler then
     * reaches for a code that is not there. Left to throw, that becomes an
     * unhandled rejection and the process leaves on 1 - the code reserved for
     * input the CLI rejected, so a gate blames the event definitions for a
     * broken package. The mirror case, an empty `run.js`, already degrades to
     * the internal code; this is the half that did not.
     */
    const shim = planted({
      root: join(directory(), 'truncated-contract'),
      exitCode: '',
      run: "exports.run = function run() { return Promise.reject(new Error('boom')); };\n",
    });

    const { status } = runShimAt({ shim });

    expect(status).toBe(EXIT_CODES.INTERNAL);
  });

  it('shows a load-time defect as itself, not as a missing build', () => {
    /**
     * A module that is present and throws is the tool being broken, not
     * the install. Reported as "reinstall the package" it sends the user
     * to repair the one thing that is fine, and hides the stack that
     * says what actually failed.
     */
    const shim = planted({
      root: join(directory(), 'defect'),
      exitCode: EXIT_CODE_MODULE,
      run: "throw new TypeError('a defect at module load');\n",
    });

    const { status, stderr } = runShimAt({ shim });

    expect(status).toBe(EXIT_CODES.INTERNAL);
    expect(stderr).toContain('a defect at module load');
    expect(stderr).not.toContain('reinstall the package');
  });

  it('is loaded by the shim the way the build emits it', () => {
    /**
     * The shim is `.cjs` and reaches the CLI with `require`, which works
     * because the build emits CommonJS: `module: Node16` with no `type`
     * field in the manifest. Flip either and the published binary throws
     * ERR_REQUIRE_ESM before `run` is ever called, so the pair is pinned
     * here rather than assumed - whoever migrates the package to ESM is
     * told, by this test, that the shim moves with it.
     */
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      type?: string;
    };
    const compiler = JSON.parse(readFileSync(join(REPO_ROOT, 'tsconfig.base.json'), 'utf8')) as {
      compilerOptions: { module: string };
    };

    expect(manifest.type).toBeUndefined();
    expect(compiler.compilerOptions.module).toBe('Node16');
    expect(readFileSync(SHIM, 'utf8')).toContain("require('../dist/src/cli/run.js')");
  });

  it('loads the CLI through literal specifiers, which is what makes the executable', () => {
    /**
     * The standalone executable is compiled from this file, and a bundler
     * follows a literal specifier and nothing else. Written as the constants
     * below it, the compile succeeds and packs the shim alone: an executable
     * that answers every invocation with its own build being missing, from a
     * build that reported success. Nothing about compiling says so, which is
     * why it is pinned here.
     *
     * The constants still exist for the classifier, so the two spellings have
     * to agree - that is the second half of this test.
     */
    const source = readFileSync(SHIM, 'utf8');

    expect(source).toContain("require('../dist/src/cli/exitCode.js')");
    expect(source).toContain("require('../dist/src/cli/run.js')");
    expect(source).not.toContain('require(EXIT_CODE_MODULE)');
    expect(source).not.toContain('require(RUN_MODULE)');
    expect(source).toContain("const EXIT_CODE_MODULE = '../dist/src/cli/exitCode.js';");
    expect(source).toContain("const RUN_MODULE = '../dist/src/cli/run.js';");
  });
});
