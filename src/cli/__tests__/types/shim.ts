/**
 * What a shim run reports back.
 *
 * status - the code the OS saw, or -1 when the process never started.
 * stdout / stderr - everything that reached the pipes before it left.
 */
interface ShimResult {
  status: number;
  stdout: string;
  stderr: string;
}

/**
 * Arguments of `planted`.
 *
 * root - the directory the copy of the shim is planted in.
 * exitCode / run - source for the two modules the shim loads. Omit both
 *   for a tree with no build at all.
 */
interface StandInModulesArgs {
  root: string;
  exitCode?: string;
  run?: string;
}

export type { ShimResult, StandInModulesArgs };
