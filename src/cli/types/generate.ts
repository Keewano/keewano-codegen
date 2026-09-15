import type { EmitTarget } from '../../emitters/types/emit';
import type { ParsedEvent } from '../../events/types/event';

/**
 * Input for one generation (`generate`).
 *
 * input / output - resolved absolute paths chosen by `parseArgv`.
 * target - SDK to emit for; forwarded to `emitGeneratedSource`.
 * asset - where the definition-set asset lands, for the target that
 *   emits one; written after the module, before the manifest.
 * json - also write the manifest next to `output`.
 */
interface GenerateArgs {
  input: string;
  output: string;
  target: EmitTarget;
  asset?: string | undefined;
  json: boolean;
}

/**
 * Arguments of `writeManifest`.
 *
 * output - the generated file's path; the manifest lands next to it.
 * events - the parsed events; the manifest describes the set built for
 *   exactly them.
 */
interface WriteManifestArgs {
  output: string;
  events: readonly ParsedEvent[];
}

/**
 * Arguments of `writeAsset`.
 *
 * asset - resolved path the definition-set asset is written to.
 * events - the parsed events the set is built from.
 */
interface WriteAssetArgs {
  asset: string;
  events: readonly ParsedEvent[];
}

export type { GenerateArgs, WriteAssetArgs, WriteManifestArgs };
