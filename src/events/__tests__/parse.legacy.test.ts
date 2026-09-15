/**
 * What a project still on the old layout - one JSON file per event, the
 * id written by hand - is told when it points the tool at that folder:
 * the same events as the file the tool reads now, so the reader saves
 * that instead of rewriting sixty definitions by hand, together with
 * every event whose id that file would change. What the folder may hold
 * besides old definitions is `parse.legacy.unreadable.test.ts`.
 */

import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { ParseError } from '../../shared/errors';
import { parseEventDefinitions } from '../parseEventDefinitions';

import { writeLegacyEventFile } from './helpers/definitionsFile';
import { messageOf, printedFileIn } from './helpers/legacyMessage';

describe('parseEventDefinitions: the old per-file layout', () => {
  const directory = useTempDirectory('keewano-codegen-parse-legacy-');
  const legacy = (name: string, body: unknown): void => {
    writeLegacyEventFile({ directory: directory(), name, body });
  };
  const parse = (): unknown => parseEventDefinitions({ inputFile: directory() });

  it('refuses a directory and prints the events found there as the new file, ordered by id', () => {
    /** Written in name order that disagrees with the ids, so which one orders the output shows. */
    legacy('Alpha', { id: 2501, n: 'Alpha', t: 1 });
    legacy('Zeta', { id: 2500, n: 'Zeta', t: 0 });

    expect(parse).toThrow(ParseError);
    const message = messageOf(parse);
    expect(message).toMatch(/a directory \(the old per-event layout\)/);
    expect(message).not.toMatch(/would take a new id/);
    expect(printedFileIn(message)).toEqual({
      events: [
        { eventName: 'Zeta', eventValueType: 'none' },
        { eventName: 'Alpha', eventValueType: 'string' },
      ],
    });
  });

  it('names every event whose id the new file would change', () => {
    /**
     * The old numbering could leave a gap, which a position cannot express:
     * everything after it takes a new id, and a set that shipped reports
     * under the old numbers. Silently dropping the numbers is what this pins
     * against.
     */
    legacy('First', { id: 2500, n: 'First', t: 0 });
    legacy('Later', { id: 2502, n: 'Later', t: 0 });
    legacy('Last', { id: 2510, n: 'Last', t: 0 });

    const message = messageOf(parse);
    expect(message).toMatch(/2 events would take a new id .*Later 2502 -> 2501, Last 2510 -> 2502/);
    expect(printedFileIn(message)).toEqual({
      events: [
        { eventName: 'First', eventValueType: 'none' },
        { eventName: 'Later', eventValueType: 'none' },
        { eventName: 'Last', eventValueType: 'none' },
      ],
    });
  });

  it('says event, not events, when one id moves', () => {
    legacy('First', { id: 2500, n: 'First', t: 0 });
    legacy('Third', { id: 2502, n: 'Third', t: 0 });

    expect(messageOf(parse)).toMatch(/1 event would take a new id .*Third 2502 -> 2501/);
  });

  it('orders by file name when the old files carry no ids, as those ids were assigned', () => {
    legacy('B', { n: 'B', t: 0 });
    legacy('A', { n: 'A', t: 0 });

    const message = messageOf(parse);
    expect(message).not.toMatch(/would take a new id/);
    expect(printedFileIn(message)).toEqual({
      events: [
        { eventName: 'A', eventValueType: 'none' },
        { eventName: 'B', eventValueType: 'none' },
      ],
    });
  });
});
