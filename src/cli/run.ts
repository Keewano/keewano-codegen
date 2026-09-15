/**
 * The CLI lifecycle. A run that names a command edits the definitions
 * and stops there; every other run parses argv, answers --help /
 * --version, and generates once or keeps regenerating in watch mode.
 * Either way, a thrown error is translated into the exit code contract
 * documented on `EXIT_CODES`.
 */

import type { CliArgs } from './types/argv';
import type { GenerateArgs } from './types/generate';

import { ParseError } from '../shared/errors';
import { stringifyError } from '../shared/stringifyError';
import { runWatchLoop } from '../watch/watchLoop';

import { parseArgv } from './argv';
import { asksForHelp, commandNameOf, runCommand, unknownCommandIn } from './command';
import { CLI_DEFAULTS } from './defaults';
import { describeFailure } from './describeFailure';
import { EXIT_CODES, classifyExitCode } from './exitCode';
import { generate } from './generate';
import { readPackageVersion } from './packageVersion';
import { USAGE } from './usage';

async function run(argv: readonly string[]): Promise<number> {
  /**
   * Before the flags are read at all: the command path resolves no
   * code directory, target or asset, and running it through the generate
   * parser would refuse `add` for missing a `--code` it never takes.
   */
  const command = commandNameOf(argv);
  if (command !== undefined) {
    /** Asked how to use a command, the answer is the usage - not a refusal. */
    if (asksForHelp(argv)) {
      process.stdout.write(`${USAGE}\n`);
      return EXIT_CODES.OK;
    }
    try {
      runCommand({ command, argv });
      return EXIT_CODES.OK;
    } catch (error: unknown) {
      return reportCommandFailure(error);
    }
  }
  const unknown = unknownCommandIn(argv);
  if (unknown !== undefined) {
    return reportFailure(new ParseError(`parse: unknown command "${unknown}"`));
  }

  let args: CliArgs;
  try {
    args = parseArgv(argv);
  } catch (error: unknown) {
    return reportFailure(error);
  }

  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return EXIT_CODES.OK;
  }
  if (args.version) {
    process.stdout.write(`${readPackageVersion()}\n`);
    return EXIT_CODES.OK;
  }

  const generateArgs: GenerateArgs = {
    input: args.input,
    output: args.output,
    asset: args.asset,
    target: args.target,
    json: args.json,
  };
  const initialExit = generate(generateArgs);
  if (!args.watch) return initialExit;
  process.stdout.write(`${CLI_DEFAULTS.PROGRAM_NAME}: watching ${generateArgs.input}\n`);

  try {
    /**
     * The loop starts even when the initial run failed (fix the input
     * and save - tsc-style) and returns the exit code of the last run
     * so a session ending after a failure propagates it instead of a
     * silent `OK`.
     */
    return await runWatchLoop({
      inputFile: generateArgs.input,
      onChange: () => generate(generateArgs),
      initialExit,
    });
  } catch (error: unknown) {
    process.stderr.write(`${stringifyError(error)}\n`);
    return classifyExitCode(error);
  }
}

/**
 * The usage block helps with a bad flag; an unreadable settings file is
 * I/O, not usage, and printing the page over it buries the one line that
 * says which file could not be read.
 */
function reportCommandFailure(error: unknown): number {
  const exit = classifyExitCode(error);
  process.stderr.write(`${describeFailure({ error, exit })}\n`);
  return exit;
}

/**
 * The usage block belongs to a run that was rejected before it started -
 * a bad flag. A command that got past argv fails over the definitions
 * themselves, and forty lines of usage under that one line buries it.
 */
function reportFailure(error: unknown): number {
  const exit = classifyExitCode(error);
  const usage = exit === EXIT_CODES.VALIDATION ? `\n${USAGE}` : '';
  process.stderr.write(`${stringifyError(error)}${usage}\n`);
  return exit;
}

export { run };
