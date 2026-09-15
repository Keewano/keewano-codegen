/**
 * Read declarations out of source rather than out of prose about source.
 *
 * Every surface check here looks for a declaration by matching the file text,
 * and the SDKs document their own API in the file that declares it. Matching
 * the text alone counted that documentation as the thing it documents: with
 * the seven bridge overloads commented out and only their KDoc left, the
 * comparison still reported seven of seven mirrored - the exact failure these
 * checks exist to catch, hidden behind the description of the thing checked.
 *
 * Anchoring each pattern to the start of a line does not close it, because a
 * declaration inside a block comment starts a line too. Removing the comments
 * first does, and does it once for every check instead of per pattern.
 *
 * The sources this runs over are Swift, Kotlin and TypeScript, so the string
 * model covers what those three write: double quotes everywhere, triple-quote
 * raw strings, single quotes for TypeScript strings and Kotlin characters,
 * and backticks for TypeScript templates. Modelling only double quotes read a
 * `/*` inside a TypeScript single-quoted literal as a real comment and
 * blanked everything after it. Not modelled, and absent from the files these
 * checks read: TypeScript regex literals and Swift # -delimited raw strings.
 */
'use strict';

const { C_FAMILY_SOURCE } = require('./sourceProfiles.cjs');

const ESCAPE = '\\';
const TRIPLES = ['"""', "'''"];
const DELIMITERS = new Set(['"', "'", '`']);
const BLOCK = { OPEN: '/*', CLOSE: '*/' };

/** The triple-quote opening at `index`, or undefined; both spellings are Python docstrings. */
const tripleAt = (source, index) => TRIPLES.find((triple) => source.startsWith(triple, index));

/** Inside a block comment: only the delimiters move the depth. */
function scanBlock({ source, index, out, state }) {
  const pair = source.slice(index, index + 2);
  if (pair === BLOCK.OPEN || pair === BLOCK.CLOSE) {
    out.push('  ');
    const step = pair === BLOCK.OPEN ? 1 : -1;
    return { index: index + 2, depth: state.depth + step, quote: null };
  }
  out.push(source[index] === '\n' ? '\n' : ' ');
  return { index: index + 1, depth: state.depth, quote: null };
}

/**
 * Inside a string literal: only its own end closes it. Content is kept by
 * default; with `blankStrings` it is padded instead, for matchers that must
 * not read a declaration out of a docstring - Python documents its API in
 * triple-quoted strings the way the other SDKs do in comments.
 */
function scanQuoted({ source, index, out, state, options }) {
  const { quote } = state;
  const keep = (text) => (options.blankStrings ? text.replaceAll(/[^\n]/g, ' ') : text);
  /**
   * Whether a backslash escapes here is the one rule the two triple-quote
   * languages disagree on. Kotlin's `"""` is raw, so `\"""` ends the
   * literal and the data keeps the backslash; Python's does not, so the
   * same three characters are an escaped quote and the literal runs on.
   * Reading Kotlin the Python way never leaves the string, and every
   * comment after it survives the strip - a declaration commented out
   * downstream would then be counted as one the SDK still publishes.
   */
  const raw = quote.length === 3 && options.rawTriples;
  if (!raw && source[index] === ESCAPE) {
    out.push(keep(source.slice(index, index + 2)));
    return { index: index + 2, depth: 0, quote };
  }
  if (quote.length === 3) {
    if (source.startsWith(quote, index)) {
      out.push(quote);
      return { index: index + 3, depth: 0, quote: null };
    }
    out.push(keep(source[index]));
    return { index: index + 1, depth: 0, quote };
  }
  const closes = source[index] === quote;
  out.push(closes ? source[index] : keep(source[index]));
  return { index: index + 1, depth: 0, quote: closes ? null : quote };
}

/** Outside both: what opens here decides where the next character is read. */
function scanCode({ source, index, out, options }) {
  const triple = tripleAt(source, index);
  if (triple !== undefined) {
    out.push(triple);
    return { index: index + 3, depth: 0, quote: triple };
  }
  const character = source[index];
  if (DELIMITERS.has(character)) {
    out.push(character);
    return { index: index + 1, depth: 0, quote: character };
  }
  if (options.blockComments && source.slice(index, index + 2) === BLOCK.OPEN) {
    out.push('  ');
    return { index: index + 2, depth: 1, quote: null };
  }
  if (source.startsWith(options.lineComment, index)) {
    return { index: blankToEndOfLine({ source, index, out }), depth: 0, quote: null };
  }
  out.push(character);
  return { index: index + 1, depth: 0, quote: null };
}

/** Blanks a line comment in place, so the newline still lands where it was. */
function blankToEndOfLine({ source, index, out }) {
  let cursor = index;
  while (cursor < source.length && source[cursor] !== '\n') {
    out.push(' ');
    cursor += 1;
  }
  return cursor;
}

function stepFor({ depth, quote }) {
  if (depth > 0) return scanBlock;
  if (quote !== null) return scanQuoted;
  return scanCode;
}

/**
 * The source with comments blanked and everything else, including length and
 * line structure, left where it was - offsets and `^` anchors still hold.
 *
 * `options` is a language profile from `sourceProfiles.cjs`, defaulting to
 * the C-family one; a partial object overrides only the rules it names.
 */
function stripComments(source, options = {}) {
  const resolved = { ...C_FAMILY_SOURCE, ...options };
  const out = [];
  let state = { index: 0, depth: 0, quote: null };
  while (state.index < source.length) {
    const next = stepFor(state)({ source, index: state.index, out, state, options: resolved });
    state = next;
  }
  return out.join('');
}

/**
 * An annotation and the spaces after it, removed rather than blanked, so
 * what follows returns to the column it was written at.
 *
 * Two matchers need this and neither can read past one. A pattern that
 * reads the modifier beside a keyword loses it to `internal @JvmStatic
 * fun`, where the annotation sits between them. A pattern anchored on
 * one level of indentation loses `@JvmStatic fun reportX(` entirely,
 * because the keyword no longer starts at that column - and blanking
 * would not bring it back, only deleting does.
 *
 * Matched at a token boundary, so an `@` inside a string literal, which
 * the comment strip keeps, is left where it is.
 */
const ANNOTATION = /(?<=^|\s)@\w+(?:\.\w+)*(?:\([^)\n]*\))?[ \t]*/gm;

const stripAnnotations = (source) => source.replaceAll(ANNOTATION, '');

module.exports = { stripAnnotations, stripComments };
