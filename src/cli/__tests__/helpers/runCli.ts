/**
 * Stream capture for CLI tests: redirect `process.stdout.write` /
 * `process.stderr.write` into in-memory buffers while the code under
 * test runs. `runCli` is the whole ceremony for one invocation - run,
 * capture, restore even when an assertion throws - so a test reads
 * like `const { exit, stdout } = await runCli([...])`.
 */

import type { CapturedOutput, CapturedStreams, CliRun } from '../types/runCli';

import { run } from '../../run';

function decodeChunk(chunk: string | Uint8Array): string {
  return typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
}

function captureStreams(): CapturedStreams {
  const captured: CapturedOutput = { stdout: [], stderr: [] };
  const realStdout = process.stdout.write.bind(process.stdout);
  const realStderr = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    captured.stdout.push(decodeChunk(chunk));
    return true;
  };
  process.stderr.write = (chunk: string | Uint8Array): boolean => {
    captured.stderr.push(decodeChunk(chunk));
    return true;
  };
  return {
    captured,
    restore: (): void => {
      process.stdout.write = realStdout;
      process.stderr.write = realStderr;
    },
  };
}

async function runCli(argv: readonly string[]): Promise<CliRun> {
  const { captured, restore } = captureStreams();
  try {
    const exit = await run(argv);
    return { exit, stdout: captured.stdout.join(''), stderr: captured.stderr.join('') };
  } finally {
    restore();
  }
}

export { runCli };
