/**
 * The TypeScript emitter, shared by every SDK on that stack. One
 * template serves four targets because they differ only in the module
 * the generated file imports and in the wrapper shape: `react-native`,
 * `expo` and `web` forward to the top-level `Keewano.reportCustomEvent`;
 * `node` threads a per-batch `UserReporter` through each wrapper
 * because the relay emits inside `reportUserBatch`.
 *
 * The generated file has three parts: the header comment rendered by
 * `headerComment.ts`, a typed wrapper per event that the host calls
 * exactly like a built-in report method, and the `customEventSet`
 * export rendered by `setExport.ts`.
 * Deterministic by construction: no timestamps, no unordered iteration.
 */

import type { CustomEventTypeValue } from '../../events/customEventType';
import type { ParsedEvent } from '../../events/types/event';
import type { BuiltEvents } from '../../set/types/buildCustomEventSet';
import type { Emitter } from '../types/emitter';
import type { TargetSpec, TypeScriptTarget, WrapperStyle } from '../types/typescript';

import { NO_EVENTS_COMMENT } from '../lineCommentHeader';

import { renderHeaderComment } from './headerComment';
import { renderSetExport } from './setExport';

const WRAPPER_STYLE = {
  TOP_LEVEL: 'top-level',
  REPORTER: 'reporter',
} as const satisfies Record<string, WrapperStyle>;

/**
 * Per-target module + wrapper style. The `Record<...>` key union
 * forces every TypeScript target to be declared here.
 */
const TARGET_SPEC_BY_TARGET: Readonly<Record<TypeScriptTarget, TargetSpec>> = {
  'react-native': { moduleName: '@keewano/react-native-sdk', style: WRAPPER_STYLE.TOP_LEVEL },
  expo: { moduleName: '@keewano/react-native-expo-sdk', style: WRAPPER_STYLE.TOP_LEVEL },
  node: { moduleName: '@keewano/node-sdk', style: WRAPPER_STYLE.REPORTER },
  web: { moduleName: '@keewano/web-sdk', style: WRAPPER_STYLE.TOP_LEVEL },
};

/**
 * Per-type parameter list for the generated wrapper. Indexed by
 * `CustomEventTypeValue` so a new payload type fails to compile until
 * its parameter is declared. `None` takes no argument and forwards no
 * `value`.
 */
const WRAPPER_PARAM_BY_TYPE: Readonly<Record<CustomEventTypeValue, string>> = {
  0: '',
  1: 'value: string',
  2: 'value: number',
  3: 'value: boolean',
  4: 'value: Date',
  5: 'value: { x: number; y: number }',
  6: 'value: number',
};

class TypeScriptEmitter implements Emitter {
  private readonly spec: TargetSpec;
  private readonly target: TypeScriptTarget;

  constructor(target: TypeScriptTarget) {
    this.spec = TARGET_SPEC_BY_TARGET[target];
    this.target = target;
  }

  /** The name is interpolated unchanged, so this spelling is one-to-one. */
  reporterNameFor(name: string): string {
    return `report${name}`;
  }

  emit({ events, built }: BuiltEvents): string {
    const sections = [
      renderHeaderComment({ events, target: this.target }),
      this.renderImports(events),
      this.renderWrappers(events),
      renderSetExport({ built, events }),
    ];
    return `${sections.join('\n\n')}\n`;
  }

  /**
   * Only what the file goes on to use. Without wrappers there is no
   * receiver to import and no reporter type to name, and the host builds
   * this file with its own settings: under `noUnusedLocals` an import it
   * was told to commit and never edit would fail its build.
   */
  private renderImports(events: readonly ParsedEvent[]): string {
    const setType = `import type { CustomEventSet } from '${this.spec.moduleName}';`;
    if (events.length === 0) return setType;
    if (this.spec.style === WRAPPER_STYLE.REPORTER) {
      return `import type { CustomEventSet, UserReporter } from '${this.spec.moduleName}';`;
    }
    return [setType, '', `import { Keewano } from '${this.spec.moduleName}';`].join('\n');
  }

  private renderWrappers(events: readonly ParsedEvent[]): string {
    if (events.length === 0) {
      return NO_EVENTS_COMMENT;
    }
    return events.map((event) => this.renderWrapper(event)).join('\n\n');
  }

  private renderWrapper(event: ParsedEvent): string {
    const isReporterStyle = this.spec.style === WRAPPER_STYLE.REPORTER;
    const valueParam = WRAPPER_PARAM_BY_TYPE[event.type];
    const forwardValue = valueParam === '' ? '' : ', value';
    const reporterParam = isReporterStyle ? 'reporter: UserReporter' : '';
    const receiver = isReporterStyle ? 'reporter' : 'Keewano';
    const params = [reporterParam, valueParam].filter((param) => param !== '').join(', ');
    return [
      `export function report${event.name}(${params}): void {`,
      `  ${receiver}.reportCustomEvent({ name: '${event.name}'${forwardValue} });`,
      '}',
    ].join('\n');
  }
}

export { TypeScriptEmitter };
