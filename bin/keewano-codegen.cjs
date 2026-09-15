#!/usr/bin/env node
/**
 * Shim that boots the compiled CLI. Kept as `.cjs` so npm's bin
 * resolution works on hosts that have not set `"type": "module"` on
 * their own package.json. The actual CLI logic lives in TypeScript
 * under `src/cli/run.ts` and is compiled to `dist/src/cli/run.js`.
 *
 * The shim MUST propagate `run()`'s returned exit code to the OS, or
 * CI scripts gating on the documented exit-code contract would see
 * every invocation as success. It sets `process.exitCode` rather than
 * calling `process.exit()`: on POSIX a pipe is written asynchronously,
 * which is what a CI runner hands the process, and exiting outright
 * would cut off whatever had not drained. Everything the CLI starts has
 * finished by the time the promise settles, so the loop empties and the
 * process leaves on its own.
 */
'use strict';

/**
 * The contract's own INTERNAL, spelled out here because the module that
 * names it is exactly what may have failed to load. A test pins it
 * against `EXIT_CODES.INTERNAL`, so the two cannot drift apart quietly.
 */
const INTERNAL_WITHOUT_THE_BUILD = 3;

/**
 * The specifiers the loads above use, spelled again here for the classifier
 * that recognises a missing build by them. The loads cannot name these
 * constants: this file is what the standalone executable is compiled from,
 * and a bundler that cannot follow an indirect specifier packs the shim alone
 * - the executable then reports its own build as missing on every run. A test
 * pins the two spellings together, because nothing else would notice them
 * drifting apart.
 */
const EXIT_CODE_MODULE = '../dist/src/cli/exitCode.js';
const RUN_MODULE = '../dist/src/cli/run.js';

/**
 * A missing or half-written `dist` is not the user's input being wrong,
 * and reporting it as such is worse than saying nothing: the loader's
 * own failure exits 1, which the contract reserves for rejected input,
 * so a CI script reads a broken installation as a bad event definition.
 */
let cli = null;
try {
  cli = {
    EXIT_CODES: require('../dist/src/cli/exitCode.js').EXIT_CODES,
    run: require('../dist/src/cli/run.js').run,
  };
} catch (error) {
  /**
   * Only a module that is not there means the package was not built. One
   * that is present and throws while loading is a defect in the tool,
   * and sending that user to reinstall points them at the one thing that
   * is not broken - and hides the stack that says what actually failed.
   * Node quotes the specifier verbatim, which is why both are constants.
   */
  const message = error && error.message ? String(error.message) : String(error);
  const missingBuild =
    error &&
    error.code === 'MODULE_NOT_FOUND' &&
    (message.includes(EXIT_CODE_MODULE) || message.includes(RUN_MODULE));
  process.stderr.write(
    missingBuild
      ? `keewano-codegen: the compiled CLI is missing, so nothing ran - reinstall the package or run npm run build (${message})\n`
      : `keewano-codegen: ${error?.stack ?? String(error)}\n`,
  );
  process.exitCode = INTERNAL_WITHOUT_THE_BUILD;
}

if (cli !== null) {
  /**
   * Started through a resolved promise, so a throw that happens before
   * `run` returns one lands in the same handler as a rejection. It cannot
   * today - `run` is declared async - but that is a fact about a
   * declaration two modules away, and the price of not depending on it
   * is a single tick.
   */
  Promise.resolve()
    .then(() => cli.run(process.argv.slice(2)))
    .then(
      (code) => {
        process.exitCode = code;
      },
      (error) => {
        process.stderr.write(`keewano-codegen: ${error?.stack ?? String(error)}\n`);
        /**
         * The load above accepted whatever the module exported, so a truncated
         * `exitCode.js` leaves this undefined and the handler itself throws -
         * an unhandled rejection, which leaves the process on 1, the code the
         * contract reserves for input the CLI rejected.
         */
        process.exitCode = cli.EXIT_CODES?.INTERNAL ?? INTERNAL_WITHOUT_THE_BUILD;
      },
    );
}
