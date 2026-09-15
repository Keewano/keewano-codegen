/**
 * The Python emitter. The generated file lives in the customer's own
 * package, never inside the SDK: a wheel installed with pip lands in
 * site-packages, which the developer does not own and every upgrade
 * overwrites. So the SDK exposes a public seam - `CustomEventSet` and
 * the id-based `KeewanoCodegen` entry points - and this file writes
 * against it, as `docs/custom-events.md` in the Python SDK specifies.
 *
 * Python has no overloading, so the bridge names one entry point per
 * payload type and each wrapper calls its own. The map travels as
 * base64 through `from_gzip_base64`, never as a `bytes([...])` literal:
 * a literal of any real size bloats the file and is slow to parse.
 * Deterministic by construction, like every emitter here.
 */

import type { PythonPayload } from './types/python';
import type { CustomEventTypeValue } from '../../events/customEventType';
import type { ParsedEvent } from '../../events/types/event';
import type { BuiltEvents } from '../../set/types/buildCustomEventSet';
import type { Emitter } from '../types/emitter';

import { noEventsCommentFor, renderLineCommentHeader } from '../lineCommentHeader';

const PYTHON = {
  INDENT: '    ',
  MODULE: 'keewano_sdk',
  SET_TYPE: 'CustomEventSet',
  BRIDGE: 'KeewanoCodegen',
  COMMENT: '#',
  FORMATTER_HINT: 'black, ruff, flake8',
} as const;

/**
 * Per payload type: what the wrapper takes, and which entry point it
 * calls. `timestamp` and `price_usd_cent` go through the unsigned one
 * because that is what they are on the wire - the same routing the
 * Kotlin and Swift wrappers use - and the type the backend applies
 * comes from the registered map, not from which entry point was called.
 * The bridge's `_int` and `_float` entry points serve no declared type
 * today, so no wrapper calls them.
 */
const PAYLOAD_BY_TYPE: Readonly<Record<CustomEventTypeValue, PythonPayload>> = {
  0: { parameters: '', argument: '', method: 'report_custom_event' },
  1: { parameters: 'value: str', argument: ', value', method: 'report_custom_event_str' },
  2: { parameters: 'value: int', argument: ', value', method: 'report_custom_event_uint' },
  3: { parameters: 'value: bool', argument: ', value', method: 'report_custom_event_bool' },
  4: { parameters: 'value: int', argument: ', value', method: 'report_custom_event_uint' },
  5: {
    parameters: 'x: int, y: int',
    argument: ', x, y',
    method: 'report_custom_event_ushort_pair',
  },
  6: { parameters: 'value: int', argument: ', value', method: 'report_custom_event_uint' },
};

class PythonEmitter implements Emitter {
  private readonly target: string;

  /** The registry hands over the key it registered this emitter under; nothing here repeats it. */
  constructor(target: string) {
    this.target = target;
  }

  /** The one spelling that is many-to-one, which is why the boundary asks at all. */
  reporterNameFor(name: string): string {
    return `report_${snakeCase(name)}`;
  }

  emit({ events, built }: BuiltEvents): string {
    const sections = [
      renderLineCommentHeader({
        events,
        regenerateCommand: `keewano-codegen --target ${this.target} --code <directory of this file>`,
        formatterHint: PYTHON.FORMATTER_HINT,
        commentPrefix: PYTHON.COMMENT,
      }),
      renderImport(events),
      renderSetExport(built),
    ];
    /** PEP 8 spacing: two blank lines before and between top-level definitions. */
    return `${sections.join('\n\n')}\n\n\n${renderWrappers(events)}\n`;
  }
}

/**
 * Only what the file goes on to use: without wrappers there is no bridge
 * to import, and the host lints this file with its own settings - an
 * unused import it was told to commit and never edit would flag there.
 */
function renderImport(events: readonly ParsedEvent[]): string {
  const names = events.length === 0 ? PYTHON.SET_TYPE : `${PYTHON.SET_TYPE}, ${PYTHON.BRIDGE}`;
  return `from ${PYTHON.MODULE} import ${names}`;
}

/**
 * The set the developer passes to `initialize()`. It is emitted even for
 * an empty event list: an SDK still has to be told that this project has
 * no custom events, and version 0 is how the contract spells that.
 */
function renderSetExport(built: BuiltEvents['built']): string {
  const base64 = Buffer.from(built.gzipData).toString('base64');
  return [
    `CUSTOM_EVENT_SET = ${PYTHON.SET_TYPE}.from_gzip_base64(`,
    `${PYTHON.INDENT}version=${String(built.version)},`,
    `${PYTHON.INDENT}event_count=${String(built.eventCount)},`,
    `${PYTHON.INDENT}gzip_base64="${base64}",`,
    ')',
  ].join('\n');
}

/**
 * One module-level `report_<name>` per event. Standalone functions, not
 * attributes patched onto the SDK: the contract rules out monkeypatching
 * an installed package, and a plain function is typed and greppable.
 */
function renderWrappers(events: readonly ParsedEvent[]): string {
  if (events.length === 0) return noEventsCommentFor(PYTHON.COMMENT);
  return events.map((event) => renderWrapper(event)).join('\n\n\n');
}

function renderWrapper(event: ParsedEvent): string {
  const { parameters, argument, method } = PAYLOAD_BY_TYPE[event.type];
  return [
    `def report_${snakeCase(event.name)}(${parameters}) -> None:`,
    `${PYTHON.INDENT}${PYTHON.BRIDGE}.${method}(${String(event.id)}${argument})`,
  ].join('\n');
}

/**
 * `EnemyKilled` -> `enemy_killed`, the way the contract's own example
 * spells its wrappers. An underscore lands after a lowercase letter or
 * digit that an uppercase one follows, and before the last capital of a
 * run when lowercase follows it - so `USDPrice` reads `usd_price`, not
 * `usdprice` - and digits stay glued to their word: `Event00` ->
 * `event00`.
 */
function snakeCase(name: string): string {
  return name
    .replaceAll(/(?<=[a-z0-9])(?=[A-Z])/g, '_')
    .replaceAll(/(?<=[A-Z])(?=[A-Z][a-z])/g, '_')
    .toLowerCase();
}

export { PythonEmitter, snakeCase };
