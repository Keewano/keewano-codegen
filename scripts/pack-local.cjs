/**
 * Pack the CLI into a tarball and put it where a local project can install it
 * from, so the tool can be exercised end to end long before it is published.
 *
 * A consumer that installs the tarball goes through the same resolution, the
 * same `files` list and the same bin shim a customer will: testing against the
 * working tree instead would prove the source works and say nothing about the
 * package. The SDK test environments already consume the SDK packages this way.
 *
 * The destination is an argument rather than a constant, because where anyone
 * else keeps their checkouts is not knowable from here.
 *
 * Usage: npm run pack:local -- <directory>   (default: ./packs)
 */
const { execFileSync } = require('node:child_process');
const { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } = require('node:fs');
const { join, resolve, sep } = require('node:path');

const ROOT = resolve(__dirname, '..');
const destination = resolve(process.argv[2] ?? join(ROOT, 'packs'));

if (destination === ROOT) {
  /**
   * npm pack writes into the package root, so a destination of "." would have
   * the copy land on its own source and the cleanup below remove it - the
   * script would report a tarball it had just deleted.
   */
  throw new Error('pack:local: the destination is the package root');
}
/**
 * Nothing in npm pack builds first, and a "files" entry matching nothing is not
 * a warning: without this the script packs a tarball with no CLI in it and
 * prints the command to install it. Installing the package is the whole signal
 * this script exists to produce, and a tarball that fails on install for a
 * reason that is not the package wastes it.
 */
if (!existsSync(join(ROOT, 'dist', 'src', 'cli', 'run.js'))) {
  throw new Error('pack:local: dist/ is missing, run npm run build first');
}
if (!existsSync(destination)) mkdirSync(destination, { recursive: true });
if (!statSync(destination).isDirectory()) {
  throw new Error(`pack:local: ${destination} is not a directory`);
}

/**
 * npm is run by the absolute path it told us about rather than by name: a bare
 * `npm` resolves through PATH, and a shell would sit between us and the
 * arguments. Unset means this was started outside an npm script, which is a
 * mistake worth naming rather than working around. Checked before anything is
 * removed, like every other precondition here.
 */
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('pack:local: run it through npm, as `npm run pack:local`');

/** A stale tarball beside a fresh one is the kind of thing that gets installed by mistake. */
for (const entry of readdirSync(destination)) {
  if (!/^keewano-codegen-.*\.tgz$/.test(entry)) continue;
  // The directory belongs to the caller, so what goes is named rather than assumed.
  console.log(`removing the earlier ${entry}`);
  rmSync(join(destination, entry));
}

const packed = execFileSync(process.execPath, [npmCli, 'pack', '--silent'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .pop();

if (!packed) throw new Error('pack:local: npm pack produced no tarball');

const target = join(destination, packed);
copyFileSync(join(ROOT, packed), target);
rmSync(join(ROOT, packed));

const megabytes = (statSync(target).size / 1024 / 1024).toFixed(2);
console.log(`${target} (${megabytes} MB)`);
console.log(`install it with: npm i -D "file:${target.split(sep).join('/')}"`);
