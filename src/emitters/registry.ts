/**
 * The one table that maps a `--target` value to its emitter and to the
 * name its generated file takes. Adding a language is one folder under
 * `emitters/` plus one entry here; nothing else in the pipeline knows
 * which targets exist, what a target's file is called, or which
 * extension its recorded vectors carry.
 *
 * `TARGET_NAMES` carries the declaration order out of here so a listing
 * of the targets can never drift from the table: the CLI help and the
 * validation errors read it, and so does the conformance suite, which
 * is what makes "one recorded vector per registered target" a real
 * check rather than a list repeated by hand.
 */

import type { EmitTarget } from './types/emit';
import type { Emitter } from './types/emitter';
import type { RegisteredTarget } from './types/registry';

import { KotlinEmitter } from './kotlin/kotlin';
import { PythonEmitter } from './python/python';
import { SwiftEmitter } from './swift/swift';
import { TypeScriptEmitter } from './typescript/typescript';

/** Every TypeScript target writes the same file name; only the SDK it imports differs. */
const TYPESCRIPT_FILE_NAME = 'keewano-events.generated.ts';

const TARGETS: Readonly<Record<EmitTarget, RegisteredTarget>> = {
  'react-native': {
    emitter: new TypeScriptEmitter('react-native'),
    generatedFileName: TYPESCRIPT_FILE_NAME,
  },
  expo: { emitter: new TypeScriptEmitter('expo'), generatedFileName: TYPESCRIPT_FILE_NAME },
  node: { emitter: new TypeScriptEmitter('node'), generatedFileName: TYPESCRIPT_FILE_NAME },
  web: { emitter: new TypeScriptEmitter('web'), generatedFileName: TYPESCRIPT_FILE_NAME },
  kotlin: {
    emitter: new KotlinEmitter('kotlin'),
    generatedFileName: 'KeewanoCustomEvents.Generated.kt',
    assetFileName: 'keewano_custom_events.json',
  },
  swift: {
    emitter: new SwiftEmitter('swift'),
    generatedFileName: 'KeewanoCustomEvents.Generated.swift',
  },
  python: {
    emitter: new PythonEmitter('python'),
    generatedFileName: 'keewano_custom_events.py',
  },
};

/**
 * True when `value` names a registered target. Own keys only: a bare
 * index lookup would resolve inherited keys like `__proto__` through
 * the prototype chain and slip past an `=== undefined` guard.
 */
function isEmitTarget(value: string): value is EmitTarget {
  return Object.hasOwn(TARGETS, value);
}

const TARGET_NAMES: readonly EmitTarget[] = Object.keys(TARGETS).filter(isEmitTarget);

const DEFAULT_TARGET: EmitTarget = 'react-native';

function getEmitter(target: EmitTarget): Emitter {
  return TARGETS[target].emitter;
}

/** The name the generated file takes for this target; the caller names only its directory. */
function generatedFileNameFor(target: EmitTarget): string {
  return TARGETS[target].generatedFileName;
}

/** Name of the definition-set asset, for targets whose SDK reads one; undefined otherwise. */
function assetFileNameFor(target: EmitTarget): string | undefined {
  return TARGETS[target].assetFileName;
}

export {
  DEFAULT_TARGET,
  TARGET_NAMES,
  assetFileNameFor,
  generatedFileNameFor,
  getEmitter,
  isEmitTarget,
};
