/**
 * The field names one TypeScript interface declares, read as declarations
 * rather than as prose.
 *
 * Only names are compared, never types. A field the two sides spell alike but
 * type differently is a real difference this does not see - and the recorded
 * vectors do see it, because they are type-checked against the stub. What the
 * vectors cannot see is a field that exists on one side and not the other,
 * which is exactly what this answers.
 */

/** Comments carry field names in prose; the stub documents its own fields above them. */
function bareBody(source) {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '');
}

/**
 * The body of `interface <name>`, brace-matched rather than regex-terminated:
 * a field whose type is an object literal carries braces of its own, and the
 * first `}` would cut the interface in half.
 */
function interfaceBody({ source, name }) {
  const start = bareBody(source).indexOf(`interface ${name}`);
  if (start < 0) return undefined;
  const text = bareBody(source);
  const open = text.indexOf('{', start);
  if (open < 0) return undefined;
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, index);
    }
  }
  return undefined;
}

/**
 * Field names at the top level of the body. Nested object literals are
 * skipped by depth, so `events: readonly { id?: number }[]` contributes
 * `events` and not `id` - a nested shape is read by naming it explicitly.
 */
function fieldNames(body) {
  const names = [];
  let depth = 0;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (depth === 0) {
      const match = /^(\w+)\??\s*:/.exec(trimmed);
      if (match?.[1] !== undefined) names.push(match[1]);
    }
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
  }
  return names;
}

/** The field names of one interface, or an empty list when it is not declared. */
function declaredFields({ source, name }) {
  const body = interfaceBody({ source, name });
  return body === undefined ? [] : fieldNames(body);
}

/**
 * The names inside the object literal a field's type is, for the one shape
 * both sides spell inline: the entry type of `events`.
 */
function inlineFields({ source, name, field }) {
  const body = interfaceBody({ source, name });
  if (body === undefined) return [];
  const line = body
    .split('\n')
    .find((candidate) => new RegExp(String.raw`^\s*${field}\??\s*:`).test(candidate));
  if (line === undefined) return [];
  /** Read between the braces by index: the literal is one level deep, and a regex for it is not. */
  const open = line.indexOf('{');
  const close = line.indexOf('}', open + 1);
  if (open < 0 || close < 0) return [];
  return line
    .slice(open + 1, close)
    .split(';')
    .map((part) => /^\s*(\w+)\??\s*:/.exec(part)?.[1])
    .filter((entry) => entry !== undefined);
}

module.exports = { declaredFields, inlineFields };
