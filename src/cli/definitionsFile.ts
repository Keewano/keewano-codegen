/**
 * The definitions file as the commands write it, and what `add` starts
 * from when there is none. The read is the parser's own: a command edits
 * exactly the document the generate path validates, so a file that is
 * already broken is reported before anything is appended to it -
 * otherwise the next run would blame the newest entry for a failure that
 * was there beforehand.
 */

import type { WriteDefinitionsArgs } from './types/definitionsFile';
import type { ParseResult } from '../events/types/parseEventDefinitions';

import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { renderDefinitions } from '../events/definitionsDocument';
import { parseEventDefinitions } from '../events/parseEventDefinitions';
import { IoError } from '../shared/errors';
import { writeIfChanged } from '../shared/writeIfChanged';

/**
 * A project has no file before its first event, and the first `add` is
 * how it gets one - but only in a directory that exists. The write below
 * would create the directory as well, and then a mistyped `--input` forks
 * the definitions into a folder nothing reads, with exit 0. A directory
 * at the path itself is not "no file" and is left to the parser, which
 * answers it with the file it should become.
 */
function loadDefinitionsOrEmpty(inputFile: string): ParseResult {
  if (existsSync(inputFile)) return parseEventDefinitions({ inputFile });
  const directory = dirname(inputFile);
  if (!existsSync(directory)) {
    throw new IoError(`add: directory not found: ${directory}`);
  }
  return { definitions: { events: [] }, events: [] };
}

function writeDefinitions({ inputFile, definitions }: WriteDefinitionsArgs): void {
  writeIfChanged({ path: inputFile, text: renderDefinitions(definitions) });
}

export { loadDefinitionsOrEmpty, writeDefinitions };
