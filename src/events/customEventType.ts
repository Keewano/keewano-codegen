/**
 * The payload-type tags of custom events and the first reserved wire
 * id. The seven values are pinned to integer literals because the
 * server-side enum uses the same numbering; the names are for humans.
 */

/** Wire-protocol payload-shape tags for custom events; uint16 LE on the wire. */
const CustomEventType = {
  None: 0,
  String: 1,
  UnsignedInt: 2,
  Bool: 3,
  Timestamp: 4,
  UnsignedShortVec2: 5,
  PriceInUSDCents: 6,
} as const;

/** Union of the seven tags, derived so the table stays the only source. */
type CustomEventTypeValue = (typeof CustomEventType)[keyof typeof CustomEventType];

/** Human-readable name per type tag; documentation only, never on the wire. */
const CUSTOM_EVENT_TYPE_NAME_BY_TYPE: Readonly<Record<CustomEventTypeValue, string>> = {
  0: 'None',
  1: 'String',
  2: 'UnsignedInt',
  3: 'Bool',
  4: 'Timestamp',
  5: 'UnsignedShortVec2',
  6: 'PriceInUSDCents',
};

/**
 * Wire names of the payload types, spelled exactly as the ingestion
 * service spells them: the REST registration body carries one per
 * event, and the JSON ingestion route validates every custom event
 * against the name it carries. This is a server contract; the human
 * names above are documentation only.
 *
 * Declared `as const` so the spellings are a type of their own: the
 * definitions file and `add --type` take exactly these, and the lookup
 * below is total over them.
 */
const CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE = {
  0: 'none',
  1: 'string',
  2: 'uint',
  3: 'bool',
  4: 'timestamp',
  5: 'ushortvec2',
  6: 'price_usd_cent',
} as const satisfies Readonly<Record<CustomEventTypeValue, string>>;

/** The seven wire spellings, derived from the table so it stays the only source. */
type CustomEventDataTypeName = (typeof CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE)[CustomEventTypeValue];

/**
 * The tag behind each wire name, inverted from the table above rather
 * than written a second time, so the two cannot disagree. The cast
 * states what inverting a one-to-one table yields; `Object.fromEntries`
 * cannot say it on its own.
 */
const CUSTOM_EVENT_TYPE_BY_DATA_TYPE_NAME = Object.fromEntries(
  Object.entries(CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE).map(([tag, name]) => [name, Number(tag)]),
) as Readonly<Record<CustomEventDataTypeName, CustomEventTypeValue>>;

/**
 * First wire id reserved for custom events. Every SDK carries this same
 * constant under its own name - it is a server-side reservation, not a
 * choice this tool makes, so the copies must never diverge. They cannot
 * drift unnoticed here: the id goes into the map bytes, so moving it
 * changes the version of every set built before and after.
 */
const FIRST_CUSTOM_EVENT_ID = 2500;

/**
 * How many custom events still fit. Every id is written as a `uint16
 * LE`, so the highest one that round-trips is 0xFFFF; with the low ids
 * reserved, this is what is left. Past it, ids would wrap into the
 * predefined range and the map would describe other events entirely.
 */
const MAX_CUSTOM_EVENT_COUNT = 0x10000 - FIRST_CUSTOM_EVENT_ID;

/** Whether a number is an id the wire reserves for custom events. */
function isCustomEventId(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= FIRST_CUSTOM_EVENT_ID &&
    value < FIRST_CUSTOM_EVENT_ID + MAX_CUSTOM_EVENT_COUNT
  );
}

/** True for one of the seven payload-type tags; own keys only. */
function isCustomEventType(value: unknown): value is CustomEventTypeValue {
  return typeof value === 'number' && Object.hasOwn(CUSTOM_EVENT_TYPE_NAME_BY_TYPE, value);
}

/** True for one of the seven wire spellings, exactly as written; own keys only. */
function isCustomEventDataTypeName(value: string): value is CustomEventDataTypeName {
  return Object.hasOwn(CUSTOM_EVENT_TYPE_BY_DATA_TYPE_NAME, value);
}

export type { CustomEventDataTypeName, CustomEventTypeValue };
export {
  CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE,
  CUSTOM_EVENT_TYPE_BY_DATA_TYPE_NAME,
  CUSTOM_EVENT_TYPE_NAME_BY_TYPE,
  CustomEventType,
  FIRST_CUSTOM_EVENT_ID,
  MAX_CUSTOM_EVENT_COUNT,
  isCustomEventDataTypeName,
  isCustomEventId,
  isCustomEventType,
};
