/**
 * One path a generation would write.
 *
 * flag - the flag that named it, for a message that says what to change.
 * path - the resolved path, or undefined where this run writes none.
 */
interface PlannedWrite {
  flag: string;
  path: string | undefined;
}

/**
 * Arguments of `assertWritesAreSafe`.
 *
 * writes - every path this generation would write.
 * definitionsFile - the file the events were read from.
 */
interface AssertWritesArgs {
  writes: readonly PlannedWrite[];
  definitionsFile: string;
}

/**
 * Arguments of `isSameFile`.
 *
 * path - the path about to be written.
 * other - the file it must not turn out to be.
 */
interface IsSameFileArgs {
  path: string;
  other: string;
}

export type { AssertWritesArgs, IsSameFileArgs, PlannedWrite };
