# schemas

One file: `keewano-events.schema.json`, the shape of the definitions file -
every event of a project, in the order that numbers them.

It is not documentation. The parser imports it and validates the file against
it, and `src/events/eventName.ts` reads the name pattern and `maxLength` out of
it rather than repeating them, so the schema is the one place those limits are
stated. Editing it changes what the generator accepts.

## What it fixes, and why

| Field            | Rule                                                                                 | Reason                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events`         | required, an array                                                                   | an entry's position in it is the event's wire id (2500 plus the index), so the array is the numbering and nothing else is                                         |
| `eventName`      | `^[A-Z][A-Za-z0-9_]*$`                                                               | the name becomes an identifier in every target language, so it has to be legal in all of them, and PascalCase keeps the generated `report<Name>` wrapper readable |
| `eventName`      | at most 128 characters                                                               | the name is written to the wire behind a varint length, and an unbounded name would also let a pathological input dominate the gzip pass                          |
| `eventValueType` | one of `none`, `string`, `uint`, `bool`, `timestamp`, `ushortvec2`, `price_usd_cent` | the payload types by their wire names, spelled as the ingestion service spells them; any other spelling has no encoding                                           |
| -                | no other properties, at either level                                                 | an unknown key is a typo the author wants to hear about                                                                                                           |

The `eventValueType` list mirrors `CUSTOM_EVENT_DATA_TYPE_NAME_BY_TYPE` in
`src/events/customEventType.ts`. A test compares the two, so widening one
without the other fails rather than silently accepting a name nothing can
encode.

## What it deliberately does not cover

- Two entries declaring one name, and a name that is a built-in `report*`
  method: both are refused by the parser. The reserved names come from the SDKs
  (`RESERVED_EVENT_NAMES`) and change without this schema changing.
- The count cap - 63036 events, the uint16 range past 2500 - is enforced by the
  parser, where the message can say what the limit is.
- The old per-file layout, one JSON file per event in a directory: the parser
  answers a directory at `--input` with the file it should become.

The `$id` is an identity, not a location: nothing fetches it at runtime.
