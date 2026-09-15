/**
 * The path with every symbolic link in it collapsed, for a file that need
 * not exist yet.
 *
 * `path.resolve` folds `..` and the working directory and stops there: a
 * link in any segment survives it, so two paths that name one file
 * compare as different strings. That is enough to walk past a guard whose
 * whole job is to notice one file under two names - and on a first run
 * neither artifact exists, so the exact answer, the filesystem's own file
 * identity, is not available to fall back on.
 *
 * The longest prefix that does exist is resolved and the rest is appended
 * unchanged: the link is almost always in a directory that is already
 * there, while the artifact about to be written is not.
 */

import { realpathSync } from 'node:fs';
import { basename, dirname, join, resolve as resolvePath } from 'node:path';

import { isNotFoundError } from './errno';
import { IoError } from './errors';
import { stringifyError } from './stringifyError';

function realPathOf(path: string): string {
  const resolved = resolvePath(path);
  const tail: string[] = [];
  let head = resolved;
  let parent = dirname(head);
  while (parent !== head) {
    const real = realPathOrNull(head);
    if (real !== null) return join(real, ...tail);
    tail.unshift(basename(head));
    head = parent;
    parent = dirname(head);
  }
  return resolved;
}

/**
 * Absent is the ordinary case on the way up and the one thing with no
 * real path to report. Any other failure means the question could not be
 * answered, and answering "no link here" would quietly hand the caller
 * the string comparison it was trying to avoid.
 */
function realPathOrNull(path: string): string | null {
  try {
    return realpathSync(path);
  } catch (error: unknown) {
    if (isNotFoundError(error)) return null;
    throw new IoError(`resolve: cannot resolve ${path}: ${stringifyError(error)}`);
  }
}

export { realPathOf };
