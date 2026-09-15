import type { ParsedEvent } from '../../events/types/event';

/**
 * Arguments of `renderAssetJson`.
 *
 * events - the parsed list the asset describes; the set is built from it here,
 *   so the asset is that list and nothing else.
 */
interface RenderAssetJsonArgs {
  events: readonly ParsedEvent[];
}

export type { RenderAssetJsonArgs };
