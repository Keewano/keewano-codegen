/**
 * Idempotent file output: the generated artifacts are committed by the
 * customer, so a run that changes nothing must leave the file untouched
 * (no mtime churn, no empty diff). A file that exists but cannot be
 * read surfaces as an I/O failure instead of being silently replaced.
 */

import type { CarryPermissionsArgs, WriteIfChangedArgs } from './types/writeIfChanged';

import {
  chmodSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { isFsErrnoError, isNotFoundError } from './errno';
import { IoError } from './errors';
import { stringifyError } from './stringifyError';

/** The permission part of a stat mode; the high bits are the file type. */
const PERMISSION_BITS = 0o777;

/** True when the file was (re)written, false when it already matched. */
function writeIfChanged({ path, text }: WriteIfChangedArgs): boolean {
  const target = resolveLink(path);
  if (readExistingText(target) === text) return false;
  mkdirSync(dirname(target), { recursive: true });
  writeAtomically({ path: target, text });
  return true;
}

/**
 * A generated file that is a symbolic link belongs to whatever it points
 * at: replacing the link with a regular file would quietly cut off
 * everyone else who reads through it, so the write follows the link the
 * way a direct write did. A link leading nowhere resolves to nothing and
 * is replaced by the real file.
 */
function resolveLink(path: string): string {
  try {
    return realpathSync(path);
  } catch (error: unknown) {
    if (isNotFoundError(error)) return path;
    throw new IoError(`write: cannot resolve ${path}: ${stringifyError(error)}`);
  }
}

/**
 * The generated file is committed, so a truncated one is worse than an
 * outdated one: a kill or a full disk mid-write must leave the previous
 * file whole. Writing a sibling and renaming it gives exactly that - a
 * rename within one filesystem is atomic, and a sibling is on the same
 * filesystem by construction. The temporary name is dot-prefixed so a
 * listing hides it the way editors hide their own scratch, and carries
 * the pid so two runs over one folder cannot share it; `--watch` reacts
 * to the definitions file alone, so the sibling never triggers a run.
 */
function writeAtomically({ path, text }: WriteIfChangedArgs): void {
  const temporaryPath = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  try {
    writeFileSync(temporaryPath, text, 'utf8');
    carryPermissions({ from: path, to: temporaryPath });
    renameSync(temporaryPath, path);
  } catch (error: unknown) {
    removeLeftover(temporaryPath);
    throw error;
  }
}

/**
 * The replacement is a different file and starts with the permissions
 * the umask gives it, so a generated file the customer made read-only or
 * shared with a group would silently come back as an ordinary one.
 * Nothing to carry when there is no file there yet.
 */
function carryPermissions({ from, to }: CarryPermissionsArgs): void {
  const mode = existingMode(from);
  if (mode !== undefined) chmodSync(to, mode & PERMISSION_BITS);
}

function existingMode(path: string): number | undefined {
  try {
    return statSync(path).mode;
  } catch (error: unknown) {
    if (isNotFoundError(error)) return undefined;
    throw new IoError(`write: cannot stat ${path}: ${stringifyError(error)}`);
  }
}

/**
 * Best effort: the write failure about to be rethrown is what the user
 * must act on, so a filesystem that also refuses the cleanup must not
 * replace it. Anything that is not an I/O failure is a bug here and
 * still surfaces.
 */
function removeLeftover(path: string): void {
  try {
    rmSync(path, { force: true });
  } catch (error: unknown) {
    if (!isFsErrnoError(error)) throw error;
  }
}

/** `undefined` when there is no file yet; any other failure names the path. */
function readExistingText(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch (error: unknown) {
    if (isNotFoundError(error)) return undefined;
    throw new IoError(`write: cannot read ${path}: ${stringifyError(error)}`);
  }
}

export { resolveLink, writeIfChanged };
