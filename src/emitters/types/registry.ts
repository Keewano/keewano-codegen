import type { Emitter } from './emitter';

/**
 * What the pipeline knows about a target besides its template.
 *
 * emitter - the template that renders the generated file.
 * generatedFileName - what the generated file is called. The caller
 *   names the directory it goes in (`--code`) and never the file: the
 *   name is a property of the language and of the SDK that imports it,
 *   so a Swift target cannot be handed a `.ts` name. Its extension is
 *   also what the recorded conformance vectors carry, so both follow
 *   one declaration.
 * assetFileName - name of the definition-set asset for a target whose
 *   SDK loads the set from a file at launch rather than from the
 *   generated source (Android). Absent means the set travels inside the
 *   generated file. The name is the SDK's own lookup key, so it is a
 *   property of the platform, not a choice.
 */
interface RegisteredTarget {
  emitter: Emitter;
  generatedFileName: string;
  assetFileName?: string;
}

export type { RegisteredTarget };
