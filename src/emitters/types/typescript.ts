import type { EmitTarget } from './emit';
import type { ParsedEvent } from '../../events/types/event';

/** The targets the TypeScript emitter answers to - four of the seven the registry knows. */
type TypeScriptTarget = Extract<EmitTarget, 'react-native' | 'expo' | 'node' | 'web'>;

/** How the generated wrappers reach the SDK. */
type WrapperStyle = 'top-level' | 'reporter';

/**
 * Per-target emit spec.
 *
 * moduleName - public package the generated file imports from.
 * style - `top-level` imports `{ Keewano }` and forwards to
 *   `Keewano.reportCustomEvent`; `reporter` imports the `UserReporter`
 *   type and threads a `reporter` parameter through each wrapper.
 */
interface TargetSpec {
  moduleName: string;
  style: WrapperStyle;
}

/**
 * Arguments of `renderHeaderComment`.
 *
 * events - what the file exposes, listed with the ids they were given.
 * target - named in the regenerate command, so rerunning cannot quietly
 *   emit for a different SDK.
 */
interface RenderHeaderCommentArgs {
  events: readonly ParsedEvent[];
  target: TypeScriptTarget;
}

export type { RenderHeaderCommentArgs, TargetSpec, TypeScriptTarget, WrapperStyle };
