/**
 * The event-count cap, exercised through `parseEventDefinitions` itself
 * over a real file. The boundary is 63036 entries - a document of a few
 * megabytes that the schema and the parser read in well under a second,
 * so nothing is stubbed. Going through the public entry point rather
 * than calling the check directly is the point: it is the call site,
 * not the comparison, that would go missing unnoticed.
 */

import { writeFileSync } from 'node:fs';

import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { ParseError } from '../../shared/errors';
import { FIRST_CUSTOM_EVENT_ID, MAX_CUSTOM_EVENT_COUNT } from '../customEventType';
import { parseEventDefinitions } from '../parseEventDefinitions';

import { definitionsFileIn } from './helpers/definitionsFile';

/** Written by hand rather than through the fixture: the fixture maps every entry, and here there are sixty thousand. */
const writeCount = ({ file, count }: { file: string; count: number }): void => {
  const events = Array.from({ length: count }, (_, index) => ({
    eventName: `E${String(index)}`,
    eventValueType: 'none',
  }));
  writeFileSync(file, JSON.stringify({ events }), 'utf8');
};

/** One parse, whatever it throws: the file is megabytes, so the reject case reads it once. */
const thrownBy = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error: unknown) {
    return error;
  }
  return undefined;
};

describe('parseEventDefinitions: the event-count cap', () => {
  const directory = useTempDirectory('keewano-codegen-parse-cap-');

  it('accepts exactly the documented maximum, the last event on the last uint16 id', () => {
    const file = definitionsFileIn(directory());
    writeCount({ file, count: MAX_CUSTOM_EVENT_COUNT });

    const { events } = parseEventDefinitions({ inputFile: file });

    expect(events).toHaveLength(MAX_CUSTOM_EVENT_COUNT);
    expect(events.at(-1)?.id).toBe(FIRST_CUSTOM_EVENT_ID + MAX_CUSTOM_EVENT_COUNT - 1);
    expect(events.at(-1)?.id).toBe(0xffff);
  });

  it('rejects one past it', () => {
    /**
     * Past the cap the encoder would wrap event ids into the predefined
     * range, so the map would look valid and decode as somebody else's
     * events.
     */
    const file = definitionsFileIn(directory());
    writeCount({ file, count: MAX_CUSTOM_EVENT_COUNT + 1 });

    const thrown = thrownBy(() => parseEventDefinitions({ inputFile: file }));

    expect(thrown).toBeInstanceOf(ParseError);
    expect((thrown as Error).message).toMatch(/too many custom events.*maximum supported is/);
  });
});
