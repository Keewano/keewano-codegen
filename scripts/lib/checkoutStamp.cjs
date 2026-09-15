/**
 * How to name the checkout a verdict was read from.
 *
 * The surface checks speak with certainty - "a generated file written
 * against it would not build" - about a comparison whose other side is
 * whatever clone happens to sit next to this repository. A clone a few
 * commits behind produces exactly the same sentence as a real upstream
 * removal, and nothing in the line said which directory was read, so the
 * two were indistinguishable from the terminal and the false one cost an
 * investigation. Only the not-found path ever named where it looked.
 *
 * The revision is read out of `.git` rather than by running `git`: there
 * is nothing to run for a checkout exported without one, and a check that
 * only ever prints a label has no business spawning a process to do it.
 */
'use strict';

const { readFileSync } = require('node:fs');
const { dirname, join, resolve: resolvePath } = require('node:path');

const SHORT_LENGTH = 7;
const HEAD_REF = 'ref: ';

/** The checkout a compared file belongs to, stamped for a message. */
function stampFor(path) {
  const directory = dirname(path);
  const revision = revisionOf(directory);
  return revision === null ? directory : `${directory} @ ${revision}`;
}

/**
 * The short revision of the repository this directory sits in, or null
 * where there is not one to read. Every unusual shape answers the same
 * way - no repository, no HEAD, a ref nothing has written yet - because
 * a stamp without a revision is still a useful stamp, and none of this
 * is worth failing a comparison over.
 */
function revisionOf(directory) {
  const gitDirectory = findGitDirectory(directory);
  if (gitDirectory === null) return null;
  const head = readTrimmed(join(gitDirectory, 'HEAD'));
  if (head === null) return null;
  if (!head.startsWith(HEAD_REF)) return head.slice(0, SHORT_LENGTH);
  const ref = head.slice(HEAD_REF.length);
  const loose = readTrimmed(join(gitDirectory, ref));
  const revision = loose ?? packedRevision({ gitDirectory, ref });
  return revision === null ? null : revision.slice(0, SHORT_LENGTH);
}

/**
 * The repository directory above this path. `.git` is a directory in an
 * ordinary clone and a file holding `gitdir:` in a worktree or submodule,
 * and both are followed so a checkout in either shape still stamps.
 */
function findGitDirectory(directory) {
  let current = directory;
  let parent = dirname(current);
  while (parent !== current) {
    const candidate = join(current, '.git');
    const pointer = readTrimmed(candidate);
    if (pointer !== null) {
      if (!pointer.startsWith('gitdir: ')) return null;
      /**
       * Resolved against the checkout, never joined onto it: git writes an
       * absolute path here for some worktrees and a relative one for
       * submodules, and joining an absolute path onto a directory builds a
       * location nothing is at - the stamp would then lose its revision on
       * a checkout that is perfectly valid.
       */
      return resolvePath(current, pointer.slice('gitdir: '.length));
    }
    if (readTrimmed(join(candidate, 'HEAD')) !== null) return candidate;
    current = parent;
    parent = dirname(current);
  }
  return null;
}

/** The revision of a ref that lives in `packed-refs` rather than its own file. */
function packedRevision({ gitDirectory, ref }) {
  const packed = readTrimmed(join(gitDirectory, 'packed-refs'));
  if (packed === null) return null;
  const line = packed.split('\n').find((entry) => entry.endsWith(` ${ref}`));
  return line === undefined ? null : line.split(' ')[0];
}

/** The file's contents trimmed, or null when it cannot be read as one. */
function readTrimmed(path) {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return null;
  }
}

module.exports = { stampFor };
