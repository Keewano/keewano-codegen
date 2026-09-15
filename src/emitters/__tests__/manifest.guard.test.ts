/**
 * The manifest is the one artifact a consumer reads instead of decoding the
 * map, so a document that contradicts itself is trusted rather than caught.
 * The blob is built here from the events being written, which is what makes a
 * contradiction unrepresentable rather than merely checked for; what is left to
 * pin is that the contract still refuses a list the document could not describe
 * honestly, and that both exported entry points do it.
 */

import type { CustomEventTypeValue } from '../../events/customEventType';

import { makeEvent } from '../../events/__tests__/helpers/definitionsFile';
import { CustomEventType } from '../../events/customEventType';
import { ParseError } from '../../shared/errors';
import { buildManifest, renderManifest } from '../manifest';

const canonical = [
  makeEvent({ name: 'Alpha', type: CustomEventType.None, indexOffset: 0 }),
  makeEvent({ name: 'Beta', type: CustomEventType.UnsignedInt, indexOffset: 1 }),
];

describe('buildManifest: the document describes the list it was given', () => {
  it('builds the blob from the events, so the two cannot disagree', () => {
    /**
     * Taking a prebuilt blob beside the list let a build script pair one set's
     * events with another set's bytes: the version and the base64 map would
     * describe one set, the events array another, and no field would look
     * wrong. Deriving removes the second half rather than comparing it.
     */
    const manifest = buildManifest({ events: canonical });
    const alone = buildManifest({
      events: [makeEvent({ name: 'Zulu', type: CustomEventType.None, indexOffset: 0 })],
    });

    expect(manifest.eventCount).toBe(canonical.length);
    expect(manifest.events).toHaveLength(manifest.eventCount);
    expect(manifest.version).not.toBe(alone.version);
    expect(manifest.gzipDataBase64).not.toBe(alone.gzipDataBase64);
  });

  it('refuses a payload type with no server spelling', () => {
    /**
     * `dataType` is looked up by type and the document declares it required,
     * so an unknown tag used to render an event without it - a document
     * violating its own type, through JSON.stringify dropping the undefined.
     */
    const events = [
      {
        ...makeEvent({ name: 'Alpha', type: CustomEventType.None, indexOffset: 0 }),
        type: 99 as CustomEventTypeValue,
      },
    ];

    expect(() => buildManifest({ events })).toThrow(/unsupported type 99/);
  });

  it('refuses a list that is not in wire-id order, which the document promises', () => {
    const shuffled = [
      makeEvent({ name: 'Alpha', type: CustomEventType.None, indexOffset: 1 }),
      makeEvent({ name: 'Beta', type: CustomEventType.None, indexOffset: 0 }),
    ];

    expect(() => buildManifest({ events: shuffled })).toThrow(/out of order/);
  });

  it('guards renderManifest too, since that is the exported one a build script calls', () => {
    const events = [
      {
        ...makeEvent({ name: 'Alpha', type: CustomEventType.None, indexOffset: 0 }),
        type: 99 as CustomEventTypeValue,
      },
    ];

    expect(() => renderManifest({ events })).toThrow(ParseError);
  });

  it('renders the list the CLI hands it', () => {
    const manifest = buildManifest({ events: canonical });

    expect(manifest.events.map((event) => event.id)).toEqual([2500, 2501]);
    expect(manifest.events.every((event) => typeof event.dataType === 'string')).toBe(true);
  });
});
