/**
 * What an old per-event folder may hold besides old definitions, and
 * what the printed file says about each: the tool's own artifacts and
 * the sidecars of other tools are skipped, and a file that cannot be
 * read as an old definition is named as missing rather than refused on
 * its own or dropped without a word.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { mockReadFailure } from '../../shared/__tests__/helpers/readFailure';
import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { ParseError } from '../../shared/errors';
import { parseEventDefinitions } from '../parseEventDefinitions';

import { writeLegacyEventFile } from './helpers/definitionsFile';
import { messageOf, printedFileIn } from './helpers/legacyMessage';

describe('parseEventDefinitions: what else the old folder holds', () => {
  const directory = useTempDirectory('keewano-codegen-parse-legacy-other-');
  const legacy = (name: string, body: unknown): void => {
    writeLegacyEventFile({ directory: directory(), name, body });
  };
  const parse = (): unknown => parseEventDefinitions({ inputFile: directory() });

  it('skips what is not an old definition', () => {
    /**
     * The artifacts this tool wrote beside the definitions, a directory
     * named like one, and the binary sidecar macOS leaves beside a file
     * on a volume without resource forks.
     */
    legacy('Real', { id: 2500, n: 'Real', t: 0 });
    writeFileSync(join(directory(), 'README.md'), '# notes', 'utf8');
    writeFileSync(join(directory(), 'keewano-events.json'), '{"schemaVersion":1}', 'utf8');
    writeFileSync(join(directory(), 'keewano_custom_events.json'), '{"gzipBase64":""}', 'utf8');
    writeFileSync(join(directory(), '._Real.json'), Buffer.from([0x00, 0x05, 0x16, 0x07]));
    mkdirSync(join(directory(), 'Nested.json'));

    const message = messageOf(parse);
    expect(message).not.toMatch(/could not be read/);
    expect(printedFileIn(message)).toEqual({
      events: [{ eventName: 'Real', eventValueType: 'none' }],
    });
  });

  it('names an old file that is not JSON as missing from the printed file', () => {
    /**
     * Refused on its own, the error would hide that `--input` was a
     * directory at all; skipped silently, a file that was an event would
     * renumber everything after it. So the file is printed without it, and
     * the note says so.
     */
    legacy('Alpha', { id: 2500, n: 'Alpha', t: 0 });
    writeFileSync(join(directory(), 'Broken.json'), '{ not json', 'utf8');

    expect(parse).toThrow(ParseError);
    const message = messageOf(parse);
    expect(message).toMatch(/a directory \(the old per-event layout\)/);
    expect(message).toMatch(
      /1 file could not be read as an old definition and is missing from that file: Broken\.json: malformed JSON/,
    );
    expect(printedFileIn(message)).toEqual({
      events: [{ eventName: 'Alpha', eventValueType: 'none' }],
    });
  });

  it('names an old file it cannot read as missing from the printed file', () => {
    legacy('Alpha', { id: 2500, n: 'Alpha', t: 0 });
    legacy('Locked', { id: 2501, n: 'Locked', t: 0 });
    const spy = mockReadFailure({ pathSuffix: 'Locked.json', code: 'EACCES' });
    try {
      expect(parse).toThrow(ParseError);
      expect(messageOf(parse)).toMatch(/Locked\.json: cannot read file/);
    } finally {
      spy.mockRestore();
    }
  });

  it('names an old file with a value the old format never allowed as missing', () => {
    /**
     * Skipped as "not a definition", a type spelled the new way or a
     * number outside the tags would drop the event and move every id
     * after it; the file's own keys say it was meant as one.
     */
    legacy('Alpha', { n: 'Alpha', t: 'uint' });
    legacy('Beta', { n: 'Beta', t: 9 });
    legacy('Gamma', { n: 3, t: 0 });
    legacy('Delta', { n: 'Delta' });
    legacy('Epsilon', { id: 2504 });
    legacy('Real', { n: 'Real', t: 0 });

    const message = messageOf(parse);
    expect(message).toMatch(/5 files could not be read as an old definition and are missing/);
    expect(message).toMatch(/Alpha\.json: "t" is not an event type/);
    expect(message).toMatch(/Beta\.json: "t" is not an event type/);
    expect(message).toMatch(/Gamma\.json: "n" is not a string/);
    expect(message).toMatch(/Delta\.json: "t" is not an event type/);
    expect(message).toMatch(/Epsilon\.json: "n" is not a string/);
    expect(printedFileIn(message)).toEqual({
      events: [{ eventName: 'Real', eventValueType: 'none' }],
    });
  });

  it('names an old file whose id is not an event id as missing rather than renumbering', () => {
    /**
     * Read as "no id", a string id would hand the event whatever position
     * it landed on; read as a number, an id below the first custom id
     * would sort first and renumber every event behind it.
     */
    legacy('Alpha', { id: 2500, n: 'Alpha', t: 0 });
    legacy('Beta', { id: '2501', n: 'Beta', t: 2 });
    legacy('Gamma', { id: 2502, n: 'Gamma', t: 0 });
    legacy('Delta', { id: 25, n: 'Delta', t: 0 });

    const message = messageOf(parse);
    expect(message).toMatch(/Beta\.json: "id" is not an event id/);
    expect(message).toMatch(/Delta\.json: "id" is not an event id/);
    expect(message).toMatch(/Gamma 2502 -> 2501/);
    expect(printedFileIn(message)).toEqual({
      events: [
        { eventName: 'Alpha', eventValueType: 'none' },
        { eventName: 'Gamma', eventValueType: 'none' },
      ],
    });
  });
});
