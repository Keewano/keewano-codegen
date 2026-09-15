/**
 * Reading the refusal of an old per-event folder back: the message a run
 * throws, and the definitions file printed inside it.
 */

/** The message a run throws, or an empty string when it does not throw. */
function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
  return '';
}

/** The JSON document inside a message: everything after the first line, up to the first note that follows it. */
function printedFileIn(message: string): unknown {
  const lines = message.split('\n').slice(1);
  const end = lines.findIndex((line) => line.startsWith('parse:'));
  const document = end === -1 ? lines : lines.slice(0, end);
  return JSON.parse(document.join('\n'));
}

export { messageOf, printedFileIn };
