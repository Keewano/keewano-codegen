interface StripOptions {
  lineComment?: string;
  blockComments?: boolean;
  blankStrings?: boolean;
  rawTriples?: boolean;
}

/**
 * The Python profile comes from the module rather than being written out
 * here: a copy would pass while the real profile drifted, which is the
 * failure that put the profile in one place to begin with.
 */
const { PYTHON_SOURCE } = require('../lib/sourceProfiles.cjs') as { PYTHON_SOURCE: StripOptions };
const { stripComments } = require('../lib/sourceText.cjs') as {
  stripComments: (source: string, options?: StripOptions) => string;
};

/** What the surface checks rely on: offsets, line numbers and `^` all still hold. */
const keepsShape = (source: string): boolean => {
  const stripped = stripComments(source);
  return (
    stripped.length === source.length && stripped.split('\n').length === source.split('\n').length
  );
};

describe('stripComments', () => {
  it('removes a line comment and leaves the line where it was', () => {
    const source = 'fun real()  // fun commented()\nnext';
    expect(stripComments(source)).not.toContain('commented');
    expect(stripComments(source)).toContain('fun real()');
    expect(keepsShape(source)).toBe(true);
  });

  it('removes a declaration written inside a block comment', () => {
    const source = '/*\npublic static func reportCustomEvent(_ id: Int) {}\n*/\nreal';
    expect(stripComments(source)).not.toContain('reportCustomEvent');
    expect(keepsShape(source)).toBe(true);
  });

  it('removes a declaration inside a KDoc block, which starts a line too', () => {
    const source = '/**\n * fun reportCustomEvent(eventId: Int)\n */\nobject Real';
    const stripped = stripComments(source);
    expect(stripped).not.toContain('reportCustomEvent');
    expect(stripped).toContain('object Real');
  });

  it('closes only at the end of a nested block comment', () => {
    const source = '/* outer /* inner */ still comment */ code';
    const stripped = stripComments(source);
    expect(stripped.trim()).toBe('code');
  });

  it('keeps a // that is inside a string literal', () => {
    const source = 'val url = "https://api.keewano.com"\nval next = 1';
    const stripped = stripComments(source);
    expect(stripped).toContain('https://api.keewano.com');
    expect(stripped).toContain('val next = 1');
  });

  it('does not end a string on an escaped quote', () => {
    const source = 'val quoted = "a\\"b // not a comment"\nval next = 1';
    expect(stripComments(source)).toContain('// not a comment');
  });

  it('keeps the contents of a Kotlin raw string', () => {
    const source = 'val raw = """\n// still text\n"""\nval next = 1';
    const stripped = stripComments(source);
    expect(stripped).toContain('// still text');
    expect(stripped).toContain('val next = 1');
  });

  it('keeps a // inside a single-quoted string, as TypeScript writes URLs', () => {
    const source = "const url = 'https://api.keewano.com';\nnext";
    const stripped = stripComments(source);
    expect(stripped).toContain('https://api.keewano.com');
    expect(stripped).toContain('next');
  });

  it('keeps a /* inside a single-quoted string and the declaration after it', () => {
    const source = "const s = 'text /* here';\n  reportFoo(x: number): void;\n";
    expect(stripComments(source)).toContain('reportFoo(x: number): void;');
  });

  it('does not end a single-quoted string on an escaped quote', () => {
    const source = "const s = 'don\\'t';\n// gone\nkept";
    const stripped = stripComments(source);
    expect(stripped).not.toContain('gone');
    expect(stripped).toContain('kept');
  });

  it('keeps a // inside a backtick template', () => {
    const source = 'const t = `https://api.keewano.com`;\nnext';
    expect(stripComments(source)).toContain('https://api.keewano.com');
  });

  it('does not let a Kotlin char literal holding a quote open a string', () => {
    const source = "val q = '\"'\n// gone\nval r = 1";
    const stripped = stripComments(source);
    expect(stripped).not.toContain('gone');
    expect(stripped).toContain('val r = 1');
  });

  it('closes a Python docstring written with single quotes', () => {
    /**
     * `'''` used to be read as three one-character strings, so an odd
     * apostrophe in the prose left the scanner inside a literal and
     * blanked every declaration after it - which is how the reserved-name
     * check would have silently read a shorter surface than the SDK ships.
     */
    const source = "class K:\n    '''The SDK's docs.'''\n    def report_x(): pass\n";
    const stripped = stripComments(source, PYTHON_SOURCE);
    expect(stripped).toContain('def report_x()');
    expect(stripped).not.toContain('docs');
  });

  it('does not let an escaped quote close a triple-quoted string early', () => {
    const source = 'x = """ends with \\""""\ndef report_x(): pass\n';
    const stripped = stripComments(source, PYTHON_SOURCE);
    expect(stripped).toContain('def report_x()');
  });

  it('closes a Kotlin raw string on a backslash, which is data there', () => {
    /**
     * The rule the two triple-quote languages disagree on. Reading Kotlin
     * the Python way never leaves the literal, and every comment after it
     * survives the strip - so a declaration commented out downstream is
     * counted as one the SDK still publishes.
     */
    const source = 'val path = """C:\\"""\n// fun reportFake()\nfun reportReal() {}\n';
    const stripped = stripComments(source);
    expect(stripped).not.toContain('reportFake');
    expect(stripped).toContain('fun reportReal()');
  });

  it('leaves source with no comments untouched', () => {
    const source = 'object KeewanoSDK {\n    fun reportCustomEvent(eventId: Int) {}\n}\n';
    expect(stripComments(source)).toBe(source);
  });
});
