/**
 * Where a generation may not write.
 *
 * Every path the run writes is one the caller's flags led to. One
 * landing on the definitions file replaces it with generated text,
 * reports success, and leaves the next run failing on the JSON it
 * destroyed; two landing on each other leave one artifact silently
 * missing. The manifest is the likeliest to do either: it is a `.json`
 * beside the generated file, which is where a definitions file often is.
 */

import type { AssertWritesArgs, IsSameFileArgs, PlannedWrite } from './types/assertWrites';

import { statSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

import { isNotFoundError } from '../shared/errno';
import { ParseError } from '../shared/errors';
import { realPathOf } from '../shared/realPath';

/** Both rules a run's write list has to pass, in the order a reader meets them. */
function assertWritesAreSafe({ writes, definitionsFile }: AssertWritesArgs): void {
  assertNoneIsTheDefinitionsFile({ writes, definitionsFile });
  assertNoTwoAreTheSameFile(writes);
}

/** Each written path against the definitions file; the flag names which one to change. */
function assertNoneIsTheDefinitionsFile({ writes, definitionsFile }: AssertWritesArgs): void {
  for (const write of writes) {
    if (write.path === undefined) continue;
    if (isSameFile({ path: write.path, other: definitionsFile })) {
      throw new ParseError(`generate: ${write.flag} is the definitions file`);
    }
  }
}

/**
 * Two artifacts aimed at one file leave whichever is written last, and
 * the loser is missed rather than reported: an Android app whose asset
 * was overwritten by the manifest simply has no custom events.
 */
function assertNoTwoAreTheSameFile(writes: readonly PlannedWrite[]): void {
  const claimedBy = new Map<string, string>();
  for (const write of writes) {
    if (write.path === undefined) continue;
    for (const key of collisionKeys(write.path)) {
      const first = claimedBy.get(key);
      if (first !== undefined) {
        throw new ParseError(`generate: ${first} and ${write.flag} write the same file`);
      }
      claimedBy.set(key, write.flag);
    }
  }
}

/**
 * Every name under which this path could turn out to be the same file as
 * another. Both are always registered rather than one or the other:
 * identity is exact but needs the file to exist, which on a first run
 * none of them do, and keying on existence alone made the same argv pass
 * on a clean tree and fail once a file appeared. The folded path catches
 * two artifacts whose names differ only in case - one file on Windows
 * and macOS, and on a case-sensitive filesystem two that a clone onto
 * either would merge. Neither is wanted.
 *
 * The fold runs over the real path, not the resolved string: a link in a
 * parent directory survives `path.resolve`, so on a clean tree - where
 * identity has nothing to answer with - two writes aimed at one file
 * keyed differently and both went through. The one written last stayed,
 * and an Android asset overwritten by the manifest is an app with no
 * custom events and a run that reported success.
 */
function collisionKeys(path: string): readonly string[] {
  const identity = fileIdentity(path);
  const folded = realPathOf(path).toLowerCase();
  return identity === null ? [folded] : [folded, identity];
}

/**
 * Two paths name the same file when the filesystem says so, not when
 * the strings match: a different spelling of the case on Windows and
 * macOS, a hard link, and a symbolic link all reach the same bytes
 * under different names. `realpath` collapses only the last of those,
 * so the comparison asks the filesystem for the file's own identity
 * and falls back to the resolved path for a file that does not exist
 * yet - which is the ordinary case, and cannot destroy anything.
 */
function isSameFile({ path, other }: IsSameFileArgs): boolean {
  const identity = fileIdentity(path);
  if (identity === null) return resolvePath(path) === resolvePath(other);
  return fileIdentity(other) === identity;
}

/**
 * What the filesystem calls this file, or null when there is no such file.
 * Read as `bigint`: an NTFS file id runs past what a double holds, so the
 * default numeric form rounds, and two distinct files can round together.
 */
function fileIdentity(path: string): string | null {
  try {
    const stats = statSync(path, { bigint: true });
    return `${String(stats.dev)}:${String(stats.ino)}`;
  } catch (error: unknown) {
    /**
     * Absent is the ordinary case and the one thing that genuinely has no
     * identity to compare. Every other failure means the question could not be
     * answered, and answering `null` drops the comparison down to path strings
     * - which is precisely what two names for one file walk past. The read
     * already treats a file it cannot stat as an I/O failure rather than a
     * skip; this is the same question and takes the same answer.
     */
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export { assertWritesAreSafe };
