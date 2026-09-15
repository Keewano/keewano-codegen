/**
 * Happy-path contract tests for `parseEventDefinitions`. Rejections
 * live in `parse.rejection.test.ts`, I/O failures in `parse.io.test.ts`.
 */

import { writeFileSync } from 'node:fs';

import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { CustomEventType, FIRST_CUSTOM_EVENT_ID } from '../customEventType';
import { parseEventDefinitions } from '../parseEventDefinitions';

import {
  definitionsFileIn,
  writeDefinitionsFile,
  writeRawDefinitionsFile,
} from './helpers/definitionsFile';

describe('parseEventDefinitions: success cases', () => {
  const directory = useTempDirectory('keewano-codegen-parse-success-');
  const file = (): string => definitionsFileIn(directory());

  it('returns an empty event set for a file that declares none', () => {
    /**
     * Empty is a legal set, not a failure: a project wires the generator
     * into its build before it declares its first event, and the emitters
     * render a file that says so. The file itself missing is the error
     * case, and it is an IoError.
     */
    writeDefinitionsFile({ file: file(), events: [] });
    expect(parseEventDefinitions({ inputFile: file() }).events).toEqual([]);
  });

  it('parses one well-formed event with the first id, its name and its type', () => {
    writeDefinitionsFile({
      file: file(),
      events: [{ name: 'GameStart', type: CustomEventType.None }],
    });
    const { events } = parseEventDefinitions({ inputFile: file() });
    expect(events).toEqual([{ name: 'GameStart', type: 0, id: FIRST_CUSTOM_EVENT_ID }]);
  });

  it('gives each event the id of its position, whatever the names say', () => {
    /** Names in reverse alphabetical order, so a parser that sorted by name would show. */
    writeDefinitionsFile({
      file: file(),
      events: [
        { name: 'Zeta', type: 1 },
        { name: 'Mid', type: 2 },
        { name: 'Alpha', type: 0 },
      ],
    });
    const { events } = parseEventDefinitions({ inputFile: file() });
    expect(events.map((event) => event.name)).toEqual(['Zeta', 'Mid', 'Alpha']);
    expect(events.map((event) => event.id)).toEqual([2500, 2501, 2502]);
  });

  it('accepts every payload type by its wire name', () => {
    const types = [0, 1, 2, 3, 4, 5, 6] as const;
    writeDefinitionsFile({
      file: file(),
      events: types.map((type) => ({ name: `T${type}_Event`, type })),
    });
    const { events } = parseEventDefinitions({ inputFile: file() });
    expect(events.map((event) => event.type)).toEqual([...types]);
  });

  it('accepts a file that starts with a UTF-8 BOM', () => {
    /** Some editors and Windows tooling prepend one; JSON.parse alone would reject it. */
    writeFileSync(file(), '﻿{"events":[{"eventName":"Bom","eventValueType":"none"}]}', 'utf8');
    expect(parseEventDefinitions({ inputFile: file() }).events[0]?.name).toBe('Bom');
  });

  it('hands the commands the document as it is on disk, with nothing derived', () => {
    /**
     * What `add` appends to is written back verbatim; an id or a position
     * slipped in here would be written into the file.
     */
    const body = { events: [{ eventName: 'Tap', eventValueType: 'uint' }] };
    writeRawDefinitionsFile({ file: file(), body });
    expect(parseEventDefinitions({ inputFile: file() }).definitions).toEqual(body);
  });
});
