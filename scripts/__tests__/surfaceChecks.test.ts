import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * The surface check reads declarations out of an SDK checkout. What it must
 * never do is read them out of the prose that describes them: every SDK
 * documents its own API in the file that declares it, so a commented-out
 * declaration used to satisfy the comparison and report full coverage over an
 * API that was gone. Each case here is that failure, one shape at a time.
 */
const REPO = resolve(__dirname, '..', '..');
const CHECK = join(REPO, 'scripts', 'check-sdk-surfaces.cjs');
const OUR_SURFACE = join(REPO, 'conformance', '__sdk-surfaces', 'KeewanoSDK.swift');

const published = (): string => readFileSync(OUR_SURFACE, 'utf8');

/**
 * The entry point named by our own surface rather than written down again
 * here. A copy would keep these fixtures agreeing with a name the project
 * had moved on from, and the case below that renames it would then be
 * renaming something nothing else refers to.
 */
function entryName(): string {
  const match = /public final class (\w+)/.exec(published());
  if (match === null) throw new Error('our surface no longer declares an entry class');
  return match[1] as string;
}

const ENTRY = `public final class ${entryName()} {\n    private init() {}\n}\n`;

const roots: string[] = [];

/** A checkout carrying just the two files the check looks for. */
function checkout({ customEvents, entry }: { customEvents: string; entry: string }): string {
  const root = mkdtempSync(join(tmpdir(), 'keewano-surface-'));
  roots.push(root);
  const sources = join(root, 'Sources', 'KeewanoSDK');
  mkdirSync(sources, { recursive: true });
  writeFileSync(join(sources, 'KeewanoCustomEvents.swift'), customEvents);
  writeFileSync(join(sources, 'KeewanoSDK.swift'), entry);
  return root;
}

function statusFor(root: string): number {
  const result = spawnSync(process.execPath, [CHECK], {
    cwd: REPO,
    env: { ...process.env, KEEWANO_IOS_SDK: root },
    encoding: 'utf8',
  });
  return result.status ?? 1;
}

/** Turns every declaration opening with `prefix` into a line comment. */
function commentOut({ source, prefix }: { source: string; prefix: string }): string {
  return source
    .split('\n')
    .map((line) => (line.trim().startsWith(prefix) ? `    // ${line.trim()}` : line))
    .join('\n');
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe('check-sdk-surfaces against an iOS checkout', () => {
  it('passes when the checkout declares everything our surface does', () => {
    expect(statusFor(checkout({ customEvents: published(), entry: ENTRY }))).toBe(0);
  });

  it('fails when the bridge overloads survive only as comments', () => {
    const customEvents = commentOut({
      source: published(),
      prefix: 'public static func reportCustomEvent',
    });
    expect(statusFor(checkout({ customEvents, entry: ENTRY }))).toBe(1);
  });

  it('fails when the stored properties survive only as comments', () => {
    const customEvents = commentOut({ source: published(), prefix: 'public let ' });
    expect(statusFor(checkout({ customEvents, entry: ENTRY }))).toBe(1);
  });

  it('accepts an exact compared file as the override and finds its sibling entry point', () => {
    const root = checkout({ customEvents: published(), entry: ENTRY });
    const file = join(root, 'Sources', 'KeewanoSDK', 'KeewanoCustomEvents.swift');
    expect(statusFor(file)).toBe(0);
  });

  it('fails when the entry point was renamed and the old name is left in a comment', () => {
    const entry = `/*\n${ENTRY}*/\npublic final class KeewanoRenamed {\n    private init() {}\n}\n`;
    expect(statusFor(checkout({ customEvents: published(), entry }))).toBe(1);
  });
});
