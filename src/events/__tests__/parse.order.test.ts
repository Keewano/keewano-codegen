/**
 * The order that becomes the wire bytes: the order the file declares,
 * not the names, and not a number written beside them - there is none.
 * The same file yields the same sequence, and the same set hash, on
 * every machine.
 *
 * The names are deliberately out of every sorted order: a parser that
 * still sorted would pass a test where the two agree.
 */

import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { compareOrdinal } from '../../shared/compareOrdinal';
import { parseEventDefinitions } from '../parseEventDefinitions';

import { definitionsFileIn, writeDefinitionsFile } from './helpers/definitionsFile';

const DECLARED = ['ItemA', 'Item_A', 'Item0'];

describe('parseEventDefinitions: order', () => {
  const directory = useTempDirectory('keewano-codegen-parse-order-');

  it('numbers the events by position, whatever the names say', () => {
    const file = definitionsFileIn(directory());
    writeDefinitionsFile({ file, events: DECLARED.map((name) => ({ name, type: 0 })) });

    const { events } = parseEventDefinitions({ inputFile: file });

    expect(events.map((event) => event.name)).toEqual(DECLARED);
    expect(events.map((event) => event.id)).toEqual([2500, 2501, 2502]);
  });

  it('would fail if the names were sorted instead', () => {
    /** Keeps the case above from going vacuous if the declared order ever becomes a sorted one. */
    expect([...DECLARED].sort(compareOrdinal)).not.toEqual(DECLARED);
  });
});
