/**
 * Content rejections of `parseEventDefinitions`: malformed JSON, schema
 * violations, and the rules the schema cannot state. Happy paths live
 * in `parse.success.test.ts`; documents that are not a definitions file
 * at all in `parse.otherShapes.test.ts`.
 */

import { writeFileSync } from 'node:fs';

import { useTempDirectory } from '../../shared/__tests__/helpers/tempDirectory';
import { ParseError } from '../../shared/errors';
import { parseEventDefinitions } from '../parseEventDefinitions';
import { RESERVED_EVENT_NAMES } from '../reservedEventNames';

import {
  definitionsFileIn,
  writeDefinitionsFile,
  writeRawDefinitionsFile,
} from './helpers/definitionsFile';

describe('parseEventDefinitions: rejection cases', () => {
  const directory = useTempDirectory('keewano-codegen-parse-reject-');
  const file = (): string => definitionsFileIn(directory());
  const parse = (): unknown => parseEventDefinitions({ inputFile: file() });

  it('throws on malformed JSON', () => {
    writeFileSync(file(), '{ this is not json', 'utf8');
    expect(parse).toThrow(/malformed JSON/);
  });

  it('rejects a document without the events list', () => {
    writeRawDefinitionsFile({ file: file(), body: {} });
    expect(parse).toThrow(/must have required property 'events'/);
  });

  it('rejects a top-level array', () => {
    writeRawDefinitionsFile({ file: file(), body: [] });
    expect(parse).toThrow(ParseError);
  });

  it('rejects an entry without a name', () => {
    writeRawDefinitionsFile({ file: file(), body: { events: [{ eventValueType: 'none' }] } });
    expect(parse).toThrow(/eventName/);
  });

  it.each(['lowercase', '123Event', 'With-Dash'])(
    'rejects the name %p (not PascalCase)',
    (name) => {
      writeRawDefinitionsFile({
        file: file(),
        body: { events: [{ eventName: name, eventValueType: 'none' }] },
      });
      expect(parse).toThrow(/must match pattern/);
    },
  );

  it('rejects a payload type spelled any other way than the wire name', () => {
    writeRawDefinitionsFile({
      file: file(),
      body: { events: [{ eventName: 'Score', eventValueType: 'UInt' }] },
    });
    expect(parse).toThrow(/must be equal to one of the allowed values/);
  });

  it('rejects the numeric tag the old files carried', () => {
    writeRawDefinitionsFile({
      file: file(),
      body: { events: [{ eventName: 'Score', eventValueType: 2 }] },
    });
    expect(parse).toThrow(ParseError);
    expect(parse).toThrow(/eventValueType/);
  });

  it('rejects an id written into an entry, along with any other extra field', () => {
    /** An id is the entry's position; one written by hand would be a second opinion nothing reads. */
    writeRawDefinitionsFile({
      file: file(),
      body: { events: [{ eventName: 'Score', eventValueType: 'uint', id: 2500 }] },
    });
    expect(parse).toThrow(/must NOT have additional properties/);
  });

  it('rejects a name longer than the schema `maxLength` cap', () => {
    writeDefinitionsFile({ file: file(), events: [{ name: `A${'b'.repeat(200)}`, type: 0 }] });
    expect(parse).toThrow(/NOT have more than 128 characters/);
  });

  it('rejects two entries declaring one name', () => {
    /** Two entries on one name would generate one reporter twice; the ids differ, so the name check is what answers. */
    writeDefinitionsFile({
      file: file(),
      events: [
        { name: 'Twice', type: 0 },
        { name: 'Twice', type: 1 },
      ],
    });
    expect(parse).toThrow(/duplicate event name "Twice"/);
  });

  it('rejects a name whose generated wrapper would shadow a built-in report method', () => {
    /**
     * Wrappers are report<Name> with no infix; a custom event called
     * ButtonClick would generate reportButtonClick and collide with the
     * real one - silently on the web, where the generated import wins.
     */
    writeDefinitionsFile({ file: file(), events: [{ name: 'ButtonClick', type: 0 }] });
    expect(parse).toThrow(ParseError);
    expect(parse).toThrow(/"ButtonClick" is a reserved name/);
  });

  it('keeps every built-in report method name in the reserved set', () => {
    /** The set is the collision guard; a name dropped from it reopens the collision. */
    for (const name of [
      'ButtonClick',
      'WindowOpen',
      'WindowClose',
      'InAppPurchase',
      'AdRevenue',
      'CustomEvent',
      'UserBatch',
    ]) {
      expect(RESERVED_EVENT_NAMES.has(name)).toBe(true);
    }
  });
});
