/**
 * Editors save in bursts (write, rename, chmod); the watch loop runs
 * once per burst. The window is the loop's own constant, not a CLI
 * setting: it describes editors, not users.
 */

import type { CreateDebouncerArgs, Debouncer } from './types/debouncer';

const WATCH_DEBOUNCE_MS = 100;

function createDebouncer({ run }: CreateDebouncerArgs): Debouncer {
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  const cancel = (): void => {
    if (scheduled !== undefined) clearTimeout(scheduled);
    scheduled = undefined;
  };
  const trigger = (): void => {
    cancel();
    scheduled = setTimeout(() => {
      scheduled = undefined;
      run();
    }, WATCH_DEBOUNCE_MS);
  };
  return { trigger, cancel };
}

export { WATCH_DEBOUNCE_MS, createDebouncer };
