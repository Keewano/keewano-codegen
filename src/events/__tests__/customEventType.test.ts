/**
 * The payload-type tags exist in three places that must agree: the
 * table here, the readable and wire name maps beside it, and the list
 * of wire names the JSON schema accepts. A new type added to one and
 * not the others would be accepted by the parser and rendered as
 * `undefined`, or rejected by the schema after the code already knows it.
 */
import schema from '../../../schemas/keewano-events.schema.json';
import {
  CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE,
  CUSTOM_EVENT_TYPE_BY_DATA_TYPE_NAME,
  CUSTOM_EVENT_TYPE_NAME_BY_TYPE,
  CustomEventType,
  FIRST_CUSTOM_EVENT_ID,
  MAX_CUSTOM_EVENT_COUNT,
  isCustomEventDataTypeName,
  isCustomEventType,
} from '../customEventType';

const TAGS = Object.values(CustomEventType);

/** The spellings the schema lets into `eventValueType`. */
const WIRE_NAMES_IN_SCHEMA = schema.properties.events.items.properties.eventValueType.enum;

describe('custom event types', () => {
  it('lets the schema accept exactly the wire names the table spells, in tag order', () => {
    expect(WIRE_NAMES_IN_SCHEMA).toEqual(Object.values(CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE));
  });

  it('names every tag, for humans and for the server', () => {
    for (const tag of TAGS) {
      expect(CUSTOM_EVENT_TYPE_NAME_BY_TYPE[tag]).toBeDefined();
      expect(CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE[tag]).toBeDefined();
    }
    expect(Object.keys(CUSTOM_EVENT_TYPE_NAME_BY_TYPE)).toHaveLength(TAGS.length);
    expect(Object.keys(CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE)).toHaveLength(TAGS.length);
  });

  it.each([...TAGS])('recognises %i as a tag', (tag) => {
    expect(isCustomEventType(tag)).toBe(true);
  });

  it.each([-1, 7, 1.5, '1', null, undefined, {}])('rejects %p', (value) => {
    expect(isCustomEventType(value)).toBe(false);
  });
});

describe('the wire names', () => {
  it.each([...TAGS])('round-trips tag %i through its wire name', (tag) => {
    /** The inverse table is derived, not written; this is what says the derivation is right. */
    const name = CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE[tag];
    expect(isCustomEventDataTypeName(name)).toBe(true);
    expect(CUSTOM_EVENT_TYPE_BY_DATA_TYPE_NAME[name]).toBe(tag);
  });

  it.each(['UInt', 'None', 'uint ', '', '2', 'constructor', '__proto__'])(
    'refuses %p, which is not a wire name',
    (value) => {
      /** Exact spelling only: the file and `--type` share one vocabulary, and a near miss is refused by name. */
      expect(isCustomEventDataTypeName(value)).toBe(false);
    },
  );
});

describe('MAX_CUSTOM_EVENT_COUNT', () => {
  it('is the uint16 ceiling minus the first custom id', () => {
    /**
     * 0x10000 - 2500 = 63036. Past it the encoder wraps an id into the
     * predefined-event range, where the map still decodes - as somebody
     * else's events. Pinned as a number so moving the first id is loud.
     */
    expect(MAX_CUSTOM_EVENT_COUNT).toBe(63036);
    expect(MAX_CUSTOM_EVENT_COUNT).toBe(0x10000 - FIRST_CUSTOM_EVENT_ID);
  });
});
