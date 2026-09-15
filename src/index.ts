/**
 * Public programmatic entrypoint for `@keewano/codegen`: parse the
 * definitions file, build the set, emit a file for a target - and, for
 * a target whose SDK reads the set from a file at launch, the asset
 * beside it. A build script drives the pipeline through these
 * functions; the command-line surface that wraps them arrives with its
 * own slice.
 */

export type { BuildResult } from './set/types/buildCustomEventSet';
export type { CustomEventDataTypeName, CustomEventTypeValue } from './events/customEventType';
export type { ParsedEvent, RawEventDefinition, RawEventDefinitions } from './events/types/event';
export type { EmitGeneratedSourceArgs, EmitTarget } from './emitters/types/emit';
export type { RenderAssetJsonArgs } from './emitters/types/assetJson';
export type { ManifestDocument, ManifestEvent } from './emitters/types/manifest';
export type { ParseEventDefinitionsArgs, ParseResult } from './events/types/parseEventDefinitions';

export { CustomEventType, FIRST_CUSTOM_EVENT_ID } from './events/customEventType';
export { DEFINITIONS_FILE_NAME } from './events/definitionsDocument';
export { EXIT_CODES } from './cli/exitCode';
export { EmitError, IoError, ParseError } from './shared/errors';
export { buildCustomEventSet } from './set/buildCustomEventSet';
export { assetFileNameFor, generatedFileNameFor } from './emitters/registry';
export { buildManifest, renderManifest } from './emitters/manifest';
export { renderAssetJson } from './emitters/assetJson';
export { emitGeneratedSource } from './emitters/emit';
export { parseEventDefinitions } from './events/parseEventDefinitions';
export { run } from './cli/run';
