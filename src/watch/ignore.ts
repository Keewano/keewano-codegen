/**
 * What `--watch` reacts to: the definitions file, and nothing else in
 * its directory. The directory is what is watched, not the file: a watch
 * on the file alone dies with it, and an editor's save replaces the file
 * (write beside, rename over), so the loop has to see the new one appear
 * where the old one was.
 *
 * chokidar applies `ignored` to the watch root itself, so the root is
 * never filtered: ignoring it kills the whole watch before an event can
 * fire. Everything else is - siblings, sub-directories (which are then
 * not descended into), and the tool's own outputs when they land beside
 * the file. Watching the tool's own writes would re-run the pipeline
 * once more on every save.
 *
 * The root is derived here rather than passed beside the file: the two
 * could only disagree, and a root that is not the file's directory is a
 * watch that never fires and never says so.
 */

import { dirname, resolve } from 'node:path';

/**
 * Case is folded on both sides. chokidar reports an entry by the name
 * the directory listing gives it, while `--input` is spelled by the
 * caller, and on a filesystem that ignores case the two can differ in it
 * and name one file. Kept exact, that mismatch is a watch that never
 * fires and never says so; folded, the worst case on a case-sensitive
 * filesystem is a regenerate over a sibling that differs only in case,
 * which finds the output up to date.
 */
function makeIgnoredPredicate(inputFile: string): (testPath: string) => boolean {
  const resolvedFile = resolve(inputFile).toLowerCase();
  const resolvedRoot = dirname(resolvedFile);
  return (testPath: string): boolean => {
    const resolvedTest = resolve(testPath).toLowerCase();
    return resolvedTest !== resolvedRoot && resolvedTest !== resolvedFile;
  };
}

export { makeIgnoredPredicate };
