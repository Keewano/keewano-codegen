/**
 * The bridge overloads a Kotlin source publishes, as signatures that can be
 * compared between two checkouts.
 *
 * Two things decide whether an overload counts, and neither is the name. It
 * has to be a declaration rather than a line of documentation, which is what
 * the comment strip is for: the SDK documents this API in the file that
 * declares it, and matching the text alone read the description as the thing.
 * And it has to be published: Kotlin is public unless marked, so an overload
 * turned `internal` still declares its own name while no customer can call it.
 */
'use strict';

const { normalizeByType } = require('./signature.cjs');
const { stripAnnotations, stripComments } = require('./sourceText.cjs');

const BRIDGE_DECLARATION =
  /(?:(private|internal|protected|public)\s+)?fun (reportCustomEvent\w*)\(([^)]*)\)/g;

/** Absent means public in Kotlin, so only an explicit modifier can rule one out. */
const isPublished = (modifier) => modifier === undefined || modifier === 'public';

/**
 * What every matcher here reads: the source minus its prose and its
 * annotations. The modifier patterns read the token beside the keyword,
 * and Kotlin lets an annotation sit between them - `internal @JvmStatic
 * fun` kept its name matchable from the bare `fun` while the modifier
 * fell out of reach, so a narrowed overload still read as published.
 */
const bareDeclarations = (source) => stripAnnotations(stripComments(source));

/**
 * Every published bridge overload in `source`, each as `name(types)` with the
 * parameter names dropped, so two checkouts that spell them differently still
 * compare equal.
 */
function readBridgeSignatures(source) {
  return [...bareDeclarations(source).matchAll(BRIDGE_DECLARATION)]
    .filter((match) => isPublished(match[1]))
    .map((match) => `${match[2]}(${normalizeByType(match[3])})`);
}

/**
 * Whether `name` is declared as an object a customer's module can import.
 * Kotlin publishes by default, so only an explicit modifier can withdraw
 * it - and it withdraws it invisibly to a match on the name alone, which
 * is how an `internal object` used to keep the type check green.
 */
function declaresPublishedObject({ source, name }) {
  const declaration = new RegExp(
    String.raw`(?:(private|internal|protected|public)\s+)?object ${name}\b`,
  );
  const match = declaration.exec(bareDeclarations(source));
  return match !== null && isPublished(match[1]);
}

module.exports = { declaresPublishedObject, readBridgeSignatures };
