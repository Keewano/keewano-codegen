/**
 * The Kotlin emitter. The contract differs from Swift in two ways the
 * Android platform forces:
 *
 * - the definition set does not travel inside the source file. The SDK
 *   reads it at launch from a JSON asset (see `assetJson.ts`), so this
 *   file carries only the typed reporters;
 * - the package is fixed. Extension functions work from any package, so
 *   the generator has nothing to discover: the contract names
 *   `com.keewano.sdk.generated`, a sub-package that cannot split the
 *   SDK's own package across modules.
 *
 * Unsigned payloads travel as `Long`, because Kotlin's unsigned types
 * still interoperate badly with Java, and the wrappers are extension
 * functions, so unlike Swift they must be imported at the call site (an
 * IDE does that on its own).
 */

import type { KotlinPayload } from './types/kotlin';
import type { CustomEventTypeValue } from '../../events/customEventType';
import type { ParsedEvent } from '../../events/types/event';
import type { BuiltEvents } from '../../set/types/buildCustomEventSet';
import type { EmitTarget } from '../types/emit';
import type { Emitter } from '../types/emitter';

import { NO_EVENTS_COMMENT, renderLineCommentHeader } from '../lineCommentHeader';

const SDK = {
  PACKAGE: 'com.keewano.sdk',
  GENERATED_PACKAGE: 'com.keewano.sdk.generated',
  ENTRY_POINT: 'KeewanoSDK',
  BRIDGE: 'KeewanoCodegen',
  REPORT: 'reportCustomEvent',
  REPORT_USHORT_PAIR: 'reportCustomEventUShortPair',
} as const;

const KOTLIN = {
  INDENT: '    ',
  FORMATTER_HINT: '.editorconfig, detekt, ktlint',
  /**
   * ktlint's own default for the code style it ships with. A project that sets
   * its own is free to reformat what it was given - the generated file is
   * replaced whole on every run, so a formatter can only ever create a diff, and
   * the header asks to be skipped for exactly that reason. What this number
   * decides is the shape a project that configured nothing receives.
   */
  MAX_LINE_LENGTH: 140,
} as const;

/**
 * Per payload type: what the wrapper takes, and what it hands the bridge.
 * As in Swift, `timestamp` and `price_usd_cent` have no call of their own
 * and travel through the unsigned one, because that is what they are on
 * the wire; the type the backend applies comes from the registered map,
 * not from which call was made.
 *
 * `ushortvec2` is the one payload with a bridge method of its own, taking
 * both halves. The wrapper hands them over as written and the SDK decides
 * what an out-of-range half means: nothing is packed or checked in the
 * customer's file. They arrive as `Int` rather than an unsigned type for
 * the reason the SDK states - an unsigned parameter would force the caller
 * through a conversion that traps, where an out-of-range value should be a
 * dropped event with a log.
 */
const PAYLOAD_BY_TYPE: Readonly<Record<CustomEventTypeValue, KotlinPayload>> = {
  0: { parameters: '', argument: '' },
  1: { parameters: 'value: String', argument: ', value' },
  2: { parameters: 'value: Long', argument: ', value' },
  3: { parameters: 'value: Boolean', argument: ', value' },
  4: { parameters: 'value: Long', argument: ', value' },
  5: { parameters: 'x: Int, y: Int', argument: ', x, y', method: SDK.REPORT_USHORT_PAIR },
  6: { parameters: 'value: Long', argument: ', value' },
};

class KotlinEmitter implements Emitter {
  private readonly target: EmitTarget;

  /** The registry hands over the key it registered this emitter under; nothing here repeats it. */
  constructor(target: EmitTarget) {
    this.target = target;
  }

  /** The name is interpolated unchanged, so this spelling is one-to-one. */
  reporterNameFor(name: string): string {
    return `report${name}`;
  }

  emit({ events }: BuiltEvents): string {
    const sections = [
      renderLineCommentHeader({
        events,
        regenerateCommand: `keewano-codegen --target ${this.target} --code <directory of this file> --asset <assets directory>`,
        formatterHint: KOTLIN.FORMATTER_HINT,
      }),
      `package ${SDK.GENERATED_PACKAGE}`,
      renderImports(events),
      renderWrappers(events),
    ];
    return `${sections.filter((section) => section !== '').join('\n\n')}\n`;
  }
}

/** Only what the file goes on to use; without events there is nothing to import for. */
function renderImports(events: readonly ParsedEvent[]): string {
  if (events.length === 0) return '';
  return [SDK.BRIDGE, SDK.ENTRY_POINT].map((name) => `import ${SDK.PACKAGE}.${name}`).join('\n');
}

/** One `report<Name>` per event, as an extension on the SDK's entry point. */
function renderWrappers(events: readonly ParsedEvent[]): string {
  if (events.length === 0) return NO_EVENTS_COMMENT;
  return events.map((event) => renderWrapper(event)).join('\n\n');
}

/**
 * One line where it fits, wrapped where it does not - which is the rule ktlint
 * applies to an expression body, and it complains either way round if the file
 * disagrees with it.
 *
 * Always wrapping was the first shape and ktlint rejected it on the short
 * declarations that are almost all of them. Always joining would trade that for
 * the other complaint, because an event name may be 128 characters and a joined
 * line then passes 200.
 *
 * Wrapping is not a guarantee against that, only against causing it: a name long
 * enough overflows the declaration on its own, and no arrangement of the body
 * shortens it. That line is the customer's name, not our formatting.
 */
function renderWrapper(event: ParsedEvent): string {
  const { parameters, argument, method = SDK.REPORT } = PAYLOAD_BY_TYPE[event.type];
  const signature = `fun ${SDK.ENTRY_POINT}.report${event.name}(${parameters}) =`;
  const body = `${SDK.BRIDGE}.${method}(${String(event.id)}${argument})`;
  const joined = `${signature} ${body}`;
  if (joined.length <= KOTLIN.MAX_LINE_LENGTH) return joined;
  return [signature, `${KOTLIN.INDENT}${body}`].join('\n');
}

export { KotlinEmitter };
