/**
 * Arguments of `createDebouncer`.
 *
 * run - what to do once a burst of triggers has settled.
 */
interface CreateDebouncerArgs {
  run: () => void;
}

/**
 * The debounce handle the watch loop drives.
 *
 * trigger - schedule `run`, coalescing bursts of file events.
 * cancel - drop a pending run.
 */
interface Debouncer {
  trigger: () => void;
  cancel: () => void;
}

export type { CreateDebouncerArgs, Debouncer };
