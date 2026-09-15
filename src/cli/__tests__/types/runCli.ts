/**
 * What the captured streams look like.
 *
 * stdout / stderr - every chunk written while the capture was active.
 */
interface CapturedOutput {
  stdout: string[];
  stderr: string[];
}

/**
 * Return shape of `captureStreams`.
 *
 * captured - the live buffers; read them after the code under test ran.
 * restore - put the real `process.stdout.write` / `process.stderr.write` back.
 */
interface CapturedStreams {
  captured: CapturedOutput;
  restore: () => void;
}

/**
 * One CLI invocation as `runCli` reports it.
 *
 * exit - the exit code `run` returned.
 * stdout / stderr - everything written to each stream, joined.
 */
interface CliRun {
  exit: number;
  stdout: string;
  stderr: string;
}

export type { CapturedOutput, CapturedStreams, CliRun };
