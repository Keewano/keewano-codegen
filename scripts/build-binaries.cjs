/**
 * Build the CLI as a dependency-free executable for every platform we ship to.
 *
 * The point is not convenience. An SPM build-tool plugin and a CocoaPods script
 * phase run on a machine that may have no Node at all, so build-time generation
 * on iOS is only possible once the generator is an executable. Android and
 * Python developers get the same benefit.
 *
 * Cross-compilation happens from one host: every target below is produced from
 * whatever machine runs this, which is why the pipeline needs a single job
 * rather than three runners.
 *
 * Usage: npm run build:binaries [name-fragment]    (after npm run build)
 *
 * A fragment builds only the matching targets, which is what a local run
 * wants: proving a change still compiles needs one of them, not four. The
 * pipeline passes none, because every platform is shipped.
 *
 * The compiler cannot tell you it packed the entry alone rather than the CLI
 * behind it - both exit zero and land within a megabyte of each other. Two
 * things stand in for that: the shim tests pin how the entry names its
 * modules, and the guard below refuses to run without the modules themselves.
 */
const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, rmSync, statSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const OUTPUT_DIRECTORY = join(ROOT, 'binaries');
const ENTRY = join(ROOT, 'bin', 'keewano-codegen.cjs');

/**
 * The compiler is called by its own path rather than through a launcher: on
 * Windows a `.cmd` shim cannot be spawned without a shell, and going through a
 * shell would put quoting between us and the arguments.
 */
function bunExecutable() {
  const packageRoot = dirname(require.resolve('bun/package.json'));
  const candidates = [join(packageRoot, 'bin', 'bun.exe'), join(packageRoot, 'bin', 'bun')];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`build:binaries: no bun executable under ${packageRoot}`);
  return found;
}

const BUN = bunExecutable();

/**
 * What each release carries. The name is the platform, not bun's target string:
 * whoever downloads one should not have to know how it was built.
 */
const TARGETS = [
  { target: 'bun-linux-x64', name: 'keewano-codegen-linux-x64' },
  { target: 'bun-linux-arm64', name: 'keewano-codegen-linux-arm64' },
  { target: 'bun-darwin-arm64', name: 'keewano-codegen-macos-arm64' },
  { target: 'bun-darwin-x64', name: 'keewano-codegen-macos-x64' },
  { target: 'bun-windows-x64', name: 'keewano-codegen-windows-x64.exe' },
];

/**
 * Without this the compile still succeeds: bun packs the entry alone and says
 * so only in a module count nobody reads, and what ships is an executable that
 * answers every invocation with its own build being missing.
 */
if (!existsSync(join(ROOT, 'dist', 'src', 'cli', 'run.js'))) {
  throw new Error('build:binaries: dist/ is missing, run npm run build first');
}

const wanted = process.argv[2];
const selected = wanted ? TARGETS.filter((entry) => entry.name.includes(wanted)) : TARGETS;
if (selected.length === 0) {
  throw new Error(`build:binaries: no target matches "${wanted}"`);
}

mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

for (const { target, name } of selected) {
  const built = join(OUTPUT_DIRECTORY, name);
  /**
   * Removed one by one rather than by clearing the folder: a fragment run
   * would otherwise discard the targets it was not asked to rebuild, and a
   * later check would find the host's build gone rather than stale.
   */
  rmSync(built, { force: true });
  execFileSync(
    BUN,
    ['build', ENTRY, '--compile', `--target=${target}`, '--outfile', built],
    /** bun reports what it packed on stdout, the one place a shim-only bundle shows. */
    { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] },
  );
  assertLinuxLoader(built, name);
  console.log(`${name}: ${Math.round(statSync(built).size / 1024 / 1024)} MB`);
}

/**
 * The Linux target must link glibc, and the compiler will not say when it does
 * not: bun on a musl host packs itself into `bun-linux-x64`, the result runs
 * fine on that host - which is how it passed the determinism check on an
 * alpine runner - and dies everywhere else as "file not found" on a file that
 * exists. So the loader is read out of the ELF program headers here, in the
 * job that produced the file, instead of surfacing three jobs later.
 */
function assertLinuxLoader(path, name) {
  if (!name.includes('linux')) return;
  const image = readFileSync(path);
  const headerOffset = Number(image.readBigUInt64LE(0x20));
  const entrySize = image.readUInt16LE(0x36);
  for (let index = 0; index < image.readUInt16LE(0x38); index += 1) {
    const entry = headerOffset + index * entrySize;
    if (image.readUInt32LE(entry) !== 3) continue;
    const start = Number(image.readBigUInt64LE(entry + 8));
    const size = Number(image.readBigUInt64LE(entry + 32));
    const segment = image.toString('utf8', start, start + size);
    const terminator = segment.indexOf('\0');
    const loader = terminator === -1 ? segment : segment.slice(0, terminator);
    if (loader.includes('musl')) {
      throw new Error(
        `build:binaries: ${name} asks for ${loader}, so this host's bun is musl - build on a glibc image`,
      );
    }
    return;
  }
  throw new Error(
    `build:binaries: ${name} has no ELF interpreter entry, so it is not the expected binary`,
  );
}
