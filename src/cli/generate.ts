/**
 * One generation: parse the definitions file, emit the module, write it
 * - and the asset and the manifest where they were asked for - only when
 * the text changed, and map any failure to its exit code. The CLI
 * lifecycle around it - flags, help, watch - lives in run.ts.
 *
 * Each artifact builds the set it writes rather than sharing one build:
 * `emitGeneratedSource` rebuilds on purpose, so a caller cannot hand it
 * a set built for a different event list. The repeat is measured: a few
 * milliseconds at the few hundred events a project really declares, and
 * about half a second per rebuild at the 63036 the wire allows. Only the
 * second is worth anything, and not enough to loosen the guarantee.
 */

import type { GenerateArgs, WriteAssetArgs, WriteManifestArgs } from './types/generate';

import { dirname, resolve as resolvePath } from 'node:path';

import { renderAssetJson } from '../emitters/assetJson';
import { emitGeneratedSource } from '../emitters/emit';
import { renderManifest } from '../emitters/manifest';
import { parseEventDefinitions } from '../events/parseEventDefinitions';
import { resolveLink, writeIfChanged } from '../shared/writeIfChanged';

import { assertWritesAreSafe } from './assertWrites';
import { CLI_DEFAULTS } from './defaults';
import { describeFailure } from './describeFailure';
import { EXIT_CODES, classifyExitCode } from './exitCode';

function generate({ input, output, target, asset, json }: GenerateArgs): number {
  try {
    const { events } = parseEventDefinitions({ inputFile: input });
    assertWritesAreSafe({
      writes: [
        { flag: '--code', path: output },
        { flag: '--asset', path: asset },
        { flag: '--json', path: json ? manifestPathFor(output) : undefined },
      ],
      definitionsFile: input,
    });
    const source = emitGeneratedSource({ events, target });
    const status = writeIfChanged({ path: output, text: source })
      ? `wrote ${output}`
      : `${output} up to date`;
    process.stdout.write(`${CLI_DEFAULTS.PROGRAM_NAME}: ${status} (${events.length} events)\n`);
    /**
     * The asset is the set itself, so it follows the module: a failed
     * module write must not leave a fresh asset describing reporters
     * that were never written.
     */
    if (asset !== undefined) writeAsset({ asset, events });
    /**
     * The manifest follows the generated file so a failed write cannot
     * leave a manifest describing a file that does not exist. It is
     * written whenever it is requested, even when the generated file is
     * already up to date: it may have been deleted, or requested for
     * the first time on an unchanged event set.
     */
    if (json) writeManifest({ output, events });
    return EXIT_CODES.OK;
  } catch (error: unknown) {
    const exit = classifyExitCode(error);
    process.stderr.write(`${describeFailure({ error, exit })}\n`);
    return exit;
  }
}

function writeManifest({ output, events }: WriteManifestArgs): void {
  const path = manifestPathFor(output);
  if (writeIfChanged({ path, text: renderManifest({ events }) })) {
    process.stdout.write(`${CLI_DEFAULTS.PROGRAM_NAME}: wrote ${path}\n`);
  }
}

/**
 * The manifest lands next to the generated file under a fixed name -
 * next to where that file is actually written, which is why the link is
 * resolved first. The write follows a symlinked output to its target, so
 * deriving this from the link instead would put the two artifacts of one
 * run in two directories, and the manifest would describe a module that
 * is not beside it.
 */
function manifestPathFor(output: string): string {
  return resolvePath(dirname(resolveLink(resolvePath(output))), CLI_DEFAULTS.MANIFEST_FILE_NAME);
}

/** The definition set as its own file, for an SDK that reads one at launch rather than importing it. */
function writeAsset({ asset, events }: WriteAssetArgs): void {
  const text = renderAssetJson({ events });
  const status = writeIfChanged({ path: asset, text }) ? `wrote ${asset}` : `${asset} up to date`;
  process.stdout.write(`${CLI_DEFAULTS.PROGRAM_NAME}: ${status}\n`);
}

export { generate };
