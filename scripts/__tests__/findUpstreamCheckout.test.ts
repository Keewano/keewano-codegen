import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { findUpstreamCheckout } = require('../find-upstream.cjs') as {
  findUpstreamCheckout: (args: {
    suffixes: string[];
    overrideEnv?: string;
    repoRoot: string;
    sdksDirectory?: string;
  }) => { paths: string[] | null; searched: string[]; overrideFailed?: boolean; nearMiss?: string };
};

/**
 * The invariant under test: a surface spanning several files resolves as ONE
 * checkout shipping all of them. Per-file lookups let two clones of the same
 * SDK each supply half - a surface no real repository ships - and made a
 * file-valued override fail for every sibling of the file it named.
 */
const SUFFIXES = ['packages/node-sdk/src/types/relay.ts', 'packages/node-sdk/src/types/keewano.ts'];
const ENV = 'KEEWANO_TEST_CHECKOUT';

let root: string;

function checkout(name: string, suffixes: string[]): string {
  const base = join(root, name);
  for (const suffix of suffixes) {
    const path = join(base, suffix);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, 'export {};');
  }
  return base;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'upstream-checkout-'));
  delete process.env[ENV];
});

afterEach(() => {
  delete process.env[ENV];
  rmSync(root, { recursive: true, force: true });
});

const search = () =>
  findUpstreamCheckout({
    suffixes: SUFFIXES,
    overrideEnv: ENV,
    repoRoot: root,
    sdksDirectory: root,
  });

describe('findUpstreamCheckout', () => {
  it('takes both files from one complete checkout, skipping an earlier partial clone', () => {
    checkout('a-partial', [SUFFIXES[0] as string]);
    const full = checkout('b-full', SUFFIXES);
    const { paths } = search();
    expect(paths).toEqual(SUFFIXES.map((suffix) => join(full, suffix)));
  });

  it('reports the partial clone by what it lacks when no checkout is complete', () => {
    checkout('a-partial', [SUFFIXES[0] as string]);
    const result = search();
    expect(result.paths).toBeNull();
    expect(result.nearMiss).toContain('a-partial');
    expect(result.nearMiss).toContain('keewano.ts');
  });

  it('resolves every sibling from the checkout an exact-file override belongs to', () => {
    const full = checkout('b-full', SUFFIXES);
    process.env[ENV] = join(full, SUFFIXES[1] as string);
    const { paths } = search();
    expect(paths).toEqual(SUFFIXES.map((suffix) => join(full, suffix)));
  });

  it('fails an override whose checkout does not ship the whole surface', () => {
    const partial = checkout('a-partial', [SUFFIXES[0] as string]);
    process.env[ENV] = partial;
    const result = search();
    expect(result.paths).toBeNull();
    expect(result.overrideFailed).toBe(true);
  });

  it('fails an override naming a file that is not part of the surface', () => {
    const full = checkout('b-full', [...SUFFIXES, 'README.md']);
    process.env[ENV] = join(full, 'README.md');
    const result = search();
    expect(result.paths).toBeNull();
    expect(result.overrideFailed).toBe(true);
  });
});
