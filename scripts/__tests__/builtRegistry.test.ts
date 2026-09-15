import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { staleSourceFor } = require('../lib/builtRegistry.cjs') as {
  staleSourceFor: (args: {
    builtFile: string;
    sourceRoots?: { directory: string; extension: string; skip: string | null }[];
    root?: string;
  }) => string | null;
};

/**
 * The rule under test: a build is stale when any file it consumes is newer
 * than it. What it consumes is pinned here - src minus __tests__, plus the
 * bundled schemas - because widening or narrowing that set is exactly how
 * the guard would rot: demand rebuilds for files that never reach dist, or
 * miss the one that does.
 */
const ROOTS = [
  { directory: 'src', extension: '.ts', skip: '__tests__' },
  { directory: 'schemas', extension: '.json', skip: null },
];

let root: string;
let built: string;

/** A file whose mtime is `offset` seconds from the built file's. */
function fileAt(relative: string, offset: number): string {
  const path = join(root, relative);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, 'x');
  const seconds = 1_700_000_000 + offset;
  utimesSync(path, seconds, seconds);
  return path;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'built-registry-'));
  built = fileAt('dist/registry.js', 0);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('staleSourceFor', () => {
  it('returns null when every source predates the build', () => {
    fileAt('src/emitters/registry.ts', -10);
    fileAt('schemas/event.json', -10);
    expect(staleSourceFor({ builtFile: built, sourceRoots: ROOTS, root })).toBeNull();
  });

  it('names a source file the build has not seen', () => {
    const edited = fileAt('src/emitters/kotlin/kotlin.ts', 10);
    expect(staleSourceFor({ builtFile: built, sourceRoots: ROOTS, root })).toBe(edited);
  });

  it('counts an edited schema, which the build bundles', () => {
    const edited = fileAt('schemas/event.json', 10);
    expect(staleSourceFor({ builtFile: built, sourceRoots: ROOTS, root })).toBe(edited);
  });

  it('ignores a test file, which never reaches dist', () => {
    fileAt('src/emitters/__tests__/emit.test.ts', 10);
    expect(staleSourceFor({ builtFile: built, sourceRoots: ROOTS, root })).toBeNull();
  });

  it('ignores a newer file of another extension', () => {
    fileAt('src/emitters/notes.md', 10);
    expect(staleSourceFor({ builtFile: built, sourceRoots: ROOTS, root })).toBeNull();
  });

  it('treats a missing source root as nothing to be newer', () => {
    expect(staleSourceFor({ builtFile: built, sourceRoots: ROOTS, root })).toBeNull();
  });
});
