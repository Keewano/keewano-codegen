/**
 * Arguments of `readJsonFile`.
 *
 * path - absolute path of the JSON file.
 * label - prefix for the error messages, in the caller's `<fn>: <what>`
 *   form (for example `parse: Tap.json`).
 */
interface ReadJsonFileArgs {
  path: string;
  label: string;
}

export type { ReadJsonFileArgs };
