import type { ParsedEvent } from '../../events/types/event';

/**
 * SDK the generated module is emitted for. The registry under
 * `emitters/` maps each value to its template.
 */
type EmitTarget = 'react-native' | 'expo' | 'node' | 'web' | 'kotlin' | 'swift' | 'python';

/**
 * Input for `emitGeneratedSource`.
 *
 * events - parsed event list in declaration order, each id the first
 *   reserved id plus its position in the definitions file; the map is
 *   built from it and the wrappers follow it.
 * target - which SDK to emit for; the tool's documented default
 *   (`react-native`, the one the CLI help marks) when omitted.
 */
interface EmitGeneratedSourceArgs {
  events: readonly ParsedEvent[];
  target?: EmitTarget;
}

export type { EmitGeneratedSourceArgs, EmitTarget };
