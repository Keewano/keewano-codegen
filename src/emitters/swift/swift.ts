/**
 * The Swift emitter. The generated file lives in the customer's own
 * target, never inside the SDK: as soon as the SDK ships through
 * SwiftPM, CocoaPods or an XCFramework the developer cannot edit it,
 * and Swift has no partial type and no cross-module `internal`. So the
 * SDK exposes a public surface - `KeewanoCustomEventSet` and the id-based
 * `KeewanoCodegen.reportCustomEvent` - and this file writes against it.
 *
 * The map travels as base64 rather than a `[UInt8]` literal: a literal
 * of any real size is slow for the Swift type-checker and bloats the
 * file. Deterministic by construction, like every emitter here.
 */

import type { SwiftPayload } from './types/swift';
import type { CustomEventTypeValue } from '../../events/customEventType';
import type { ParsedEvent } from '../../events/types/event';
import type { BuiltEvents } from '../../set/types/buildCustomEventSet';
import type { EmitTarget } from '../types/emit';
import type { Emitter } from '../types/emitter';

import { NO_EVENTS_COMMENT, renderLineCommentHeader } from '../lineCommentHeader';

const SWIFT = {
  INDENT: '    ',
  MODULE: 'KeewanoSDK',
  BRIDGE: 'KeewanoCodegen',
  REPORT: 'reportCustomEvent',
  REPORT_USHORT_PAIR: 'reportCustomEventUShortPair',
  FORMATTER_HINT: '.swiftformat, .swiftlint.yml',
} as const;

/**
 * Per payload type: what the wrapper takes, and what it hands the
 * bridge. Every wrapper takes exactly what its bridge overload takes and
 * passes the value through: an unsigned payload is `Int64`, the type of
 * the bridge's unsigned overload, not a narrower `UInt32` widened on the
 * call - that parameter forced a caller holding an `Int` or `Int64`,
 * which is what Swift arithmetic yields, through a conversion that traps
 * on a value the SDK could have refused with a log. `timestamp` and
 * `price_usd_cent` go through that overload because that is what they
 * are on the wire, a uint32; the type the backend applies comes from the
 * registered map, not from which overload was called. `ushortvec2` has
 * a bridge call of its own, because a pair cannot be spelled as one
 * number.
 */
const PAYLOAD_BY_TYPE: Readonly<Record<CustomEventTypeValue, SwiftPayload>> = {
  0: { parameters: '', argument: '' },
  1: { parameters: '_ value: String', argument: ', value' },
  2: { parameters: '_ value: Int64', argument: ', value' },
  3: { parameters: '_ value: Bool', argument: ', value' },
  4: { parameters: '_ value: Int64', argument: ', value' },
  5: { parameters: 'x: Int, y: Int', argument: ', x, y', method: SWIFT.REPORT_USHORT_PAIR },
  6: { parameters: '_ value: Int64', argument: ', value' },
};

class SwiftEmitter implements Emitter {
  private readonly target: EmitTarget;

  /** The registry hands over the key it registered this emitter under; nothing here repeats it. */
  constructor(target: EmitTarget) {
    this.target = target;
  }

  /** The name is interpolated unchanged, so this spelling is one-to-one. */
  reporterNameFor(name: string): string {
    return `report${name}`;
  }

  emit({ events, built }: BuiltEvents): string {
    const sections = [
      renderLineCommentHeader({
        events,
        regenerateCommand: `keewano-codegen --target ${this.target} --code <directory of this file>`,
        formatterHint: SWIFT.FORMATTER_HINT,
      }),
      `import ${SWIFT.MODULE}`,
      renderSetExport(built),
      renderWrappers(events),
    ];
    return `${sections.join('\n\n')}\n`;
  }
}

/**
 * The set the developer hands to `initialize(customEvents:)`. It is
 * emitted even for an empty event list: an SDK still has to be told
 * that this project has no custom events.
 */
function renderSetExport(built: BuiltEvents['built']): string {
  const base64 = Buffer.from(built.gzipData).toString('base64');
  return [
    'public enum KeewanoCustomEvents {',
    `${SWIFT.INDENT}public static let set = KeewanoCustomEventSet(`,
    `${SWIFT.INDENT.repeat(2)}version: ${String(built.version)},`,
    `${SWIFT.INDENT.repeat(2)}eventCount: ${String(built.eventCount)},`,
    `${SWIFT.INDENT.repeat(2)}gzipBase64: "${base64}"`,
    `${SWIFT.INDENT})`,
    '}',
  ].join('\n');
}

/** One `report<Name>` per event, so a custom event is called like a built-in one. */
function renderWrappers(events: readonly ParsedEvent[]): string {
  if (events.length === 0) return NO_EVENTS_COMMENT;
  const wrappers = events.map((event) => renderWrapper(event)).join('\n\n');
  return `extension ${SWIFT.MODULE} {\n${wrappers}\n}`;
}

function renderWrapper(event: ParsedEvent): string {
  const { parameters, argument, method = SWIFT.REPORT } = PAYLOAD_BY_TYPE[event.type];
  return [
    `${SWIFT.INDENT}public static func report${event.name}(${parameters}) {`,
    `${SWIFT.INDENT.repeat(2)}${SWIFT.BRIDGE}.${method}(${String(event.id)}${argument})`,
    `${SWIFT.INDENT}}`,
  ].join('\n');
}

export { SwiftEmitter };
