/**
 * Read and parse one JSON file the way every input of the tool is read:
 * UTF-8, a leading BOM tolerated (some editors and Windows tooling
 * prepend one, and `JSON.parse` would otherwise fail with an opaque
 * "Unexpected token"), a missing file reported as `undefined`, any
 * other read failure as `IoError`, and malformed JSON as `ParseError`.
 * The caller validates the shape; this only gets it off the disk.
 */

import type { ReadJsonFileArgs } from './types/readJsonFile';

import { readFileSync } from 'node:fs';

import { isNotFoundError } from './errno';
import { IoError, ParseError } from './errors';
import { stringifyError } from './stringifyError';

const UTF8_BOM = 0xfeff;

function readJsonFile({ path, label }: ReadJsonFileArgs): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error: unknown) {
    if (isNotFoundError(error)) return undefined;
    throw new IoError(`${label}: cannot read file: ${stringifyError(error)}`);
  }
  if (text.codePointAt(0) === UTF8_BOM) text = text.slice(1);
  try {
    return JSON.parse(text);
  } catch (error: unknown) {
    throw new ParseError(`${label}: malformed JSON: ${stringifyError(error)}`);
  }
}

export { readJsonFile };
