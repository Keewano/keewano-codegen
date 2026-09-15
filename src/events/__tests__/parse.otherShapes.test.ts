/**
 * Documents handed as `--input` that are not a definitions file at all:
 * the two files this tool writes beside one, and one event in the old
 * per-file shape. Each is named for what it is, because the schema's
 * own complaint about a missing `events` key would send the reader
 * hunting for one in a file they never wrote - and a real definitions
 * file with one stray key of the same name is still reported as what it
 * is.
 */

import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { ParseError } from '../../shared/errors';
import { parseEventDefinitions } from '../parseEventDefinitions';

import { definitionsFileIn, writeRawDefinitionsFile } from './helpers/definitionsFile';

describe('parseEventDefinitions: documents that are not a definitions file', () => {
  const directory = useTempDirectory('keewano-codegen-parse-shapes-');
  const file = (): string => definitionsFileIn(directory());
  const parse = (): unknown => parseEventDefinitions({ inputFile: file() });

  it.each([
    [
      'the generated manifest',
      { schemaVersion: 1, version: 0, eventCount: 0, gzipDataBase64: '', events: [] },
      /generated manifest/,
    ],
    [
      'the definition-set asset',
      { version: 0, eventCount: 0, gzipBase64: '' },
      /definition-set asset/,
    ],
    ['one event in the old per-file shape', { id: 2500, n: 'Tap', t: 0 }, /old per-event shape/],
  ])('names %s instead of listing schema errors', (_, body, pattern) => {
    writeRawDefinitionsFile({ file: file(), body });
    expect(parse).toThrow(ParseError);
    expect(parse).toThrow(pattern);
  });

  it('reports a stray manifest key on a real definitions file as an unknown property', () => {
    /** One key the manifest also has does not make the file a manifest. */
    writeRawDefinitionsFile({
      file: file(),
      body: { schemaVersion: 1, events: [{ eventName: 'Tap', eventValueType: 'none' }] },
    });
    expect(parse).toThrow(/must NOT have additional properties/);
    expect(parse).not.toThrow(/generated manifest/);
  });
});
