/**
 * What a Swift source publishes: the stored properties and initializer a
 * generated file constructs the set with, and the bridge overloads it calls.
 *
 * Comments go first for the same reason they do on the Kotlin side. The SDK
 * documents this API in the file that declares it, so matching the file text
 * counted the documentation as the declaration: with every overload commented
 * out, the comparison still reported all of them mirrored.
 */
'use strict';

const { normalizeByLabel } = require('./signature.cjs');
const { stripComments } = require('./sourceText.cjs');

const PROPERTY = /public let (\w+): *([^\n/]+)/g;
const INITIALIZER = /public init\(([^)]*)\)/g;
const BRIDGE = /public static func (reportCustomEvent\w*)\(([^)]*)\)/g;

/**
 * The three kinds of declaration a generated file depends on, each as a string
 * two checkouts can be compared by: parameter labels are kept, because Swift
 * call sites write them, and parameter names are not.
 */
function readDeclarations(source) {
  const code = stripComments(source);
  return {
    properties: [...code.matchAll(PROPERTY)].map((match) => `${match[1]}: ${match[2].trim()}`),
    initializers: [...code.matchAll(INITIALIZER)].map((match) => normalizeByLabel(match[1])),
    bridge: [...code.matchAll(BRIDGE)].map((match) => `${match[1]}(${normalizeByLabel(match[2])})`),
  };
}

/**
 * A kind that reads as empty is never a pass. Upstream it means the file moved
 * or changed spelling and this stopped reading it; on our side it means the
 * surface lost declarations the vectors compile against. Either way the
 * comparison for that kind had nothing to do, and an empty list agrees with
 * everything, so it would have passed in silence.
 *
 * Every kind is checked rather than a named few: which ones exist is this
 * module's business, and a kind added later would otherwise be unguarded by
 * default. `path` names the file in the message.
 */
function assertRead({ surface, path }) {
  const empty = Object.keys(surface).filter((kind) => surface[kind].length === 0);
  if (empty.length === 0) return;
  throw new Error(`ios: read no ${empty.join(' or ')} out of ${path}, so nothing was compared`);
}

/**
 * Whether `name` is declared here as a type the app's module can name.
 * Swift defaults to internal, so a bare `struct X` is as unreachable from
 * generated code as a `private` one - only an explicit `public`, or `open`
 * which contains it, publishes the type. The modifiers are read off the
 * declaration's own line rather than anchored in a fixed order, so
 * `final public class` and an attribute before the modifier still count.
 */
function declaresType({ source, name }) {
  const declaration = new RegExp(
    String.raw`^([^\n]*?)\b(?:struct|class|enum|actor) ${name}\b`,
    'm',
  );
  const match = declaration.exec(stripComments(source));
  return match !== null && /\b(?:public|open)\b/.test(match[1]);
}

module.exports = { assertRead, declaresType, readDeclarations };
