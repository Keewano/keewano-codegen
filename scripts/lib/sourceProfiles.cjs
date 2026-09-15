/**
 * How each language these checks read is written down, as facts about
 * that language rather than about the scanner that consumes them.
 *
 * Kept in one place and exported because two copies of a profile drift
 * the moment a language turns out to have a rule the other does not -
 * which is exactly what happened with triple quotes: Kotlin's `"""` is
 * raw, so a trailing backslash is data and the literal still closes,
 * while Python's is not, so the same three characters are an escaped
 * quote and the literal runs on. One branch read both, and reading
 * Kotlin the Python way never left the string: every comment after it
 * survived the strip, and a declaration commented out downstream was
 * counted as one the SDK still publishes.
 *
 * Not modelled anywhere, and absent from the files these checks read:
 * TypeScript regex literals, Swift `#`-delimited raw strings, and
 * Python's `r` prefix, which would make a `"""` literal raw after all.
 */
'use strict';

/** Swift, Kotlin and TypeScript: line and nesting block comments, raw triple quotes. */
const C_FAMILY_SOURCE = {
  lineComment: '//',
  blockComments: true,
  blankStrings: false,
  rawTriples: true,
};

/**
 * Python: `#` starts a comment, a bare slash-star is code, and docstrings
 * are strings that describe the API - so their contents are blanked too,
 * or a `def` spelled inside one reads exactly like the declaration it
 * documents.
 */
const PYTHON_SOURCE = {
  lineComment: '#',
  blockComments: false,
  blankStrings: true,
  rawTriples: false,
};

module.exports = { C_FAMILY_SOURCE, PYTHON_SOURCE };
