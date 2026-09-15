const { declaresPublishedObject, readBridgeSignatures } = require('../lib/kotlinBridge.cjs') as {
  declaresPublishedObject: (args: { source: string; name: string }) => boolean;
  readBridgeSignatures: (source: string) => string[];
};

const declaration = (modifier = ''): string =>
  `object KeewanoCodegen {\n    @JvmStatic\n    ${modifier}fun reportCustomEvent(eventId: Int) {}\n}\n`;

describe('readBridgeSignatures', () => {
  it('reads a declaration with no modifier, which is public in Kotlin', () => {
    expect(readBridgeSignatures(declaration())).toEqual(['reportCustomEvent(Int)']);
  });

  it('reads one written as public', () => {
    expect(readBridgeSignatures(declaration('public '))).toEqual(['reportCustomEvent(Int)']);
  });

  it.each(['internal ', 'private ', 'protected '])(
    'drops one the SDK stopped publishing: %s',
    (modifier) => {
      expect(readBridgeSignatures(declaration(modifier))).toEqual([]);
    },
  );

  it('drops one that survives only as a line comment', () => {
    const source = 'object KeewanoCodegen {\n    // fun reportCustomEvent(eventId: Int) {}\n}\n';
    expect(readBridgeSignatures(source)).toEqual([]);
  });

  it('drops one that survives only inside a KDoc block', () => {
    const source =
      'object KeewanoCodegen {\n    /**\n     * fun reportCustomEvent(eventId: Int)\n     */\n}\n';
    expect(readBridgeSignatures(source)).toEqual([]);
  });

  it('keeps a real declaration that has documentation above it', () => {
    const source = `/** An event with no payload. */\n${declaration()}`;
    expect(readBridgeSignatures(source)).toEqual(['reportCustomEvent(Int)']);
  });

  it('reads the suffixed overload as its own name', () => {
    const source = '    fun reportCustomEventUShortPair(eventId: Int, x: Int, y: Int) {}\n';
    expect(readBridgeSignatures(source)).toEqual(['reportCustomEventUShortPair(Int,Int,Int)']);
  });

  it('reads nothing out of a file that declares nothing', () => {
    expect(readBridgeSignatures('object KeewanoCodegen {\n}\n')).toEqual([]);
  });

  it.each([
    'internal @JvmStatic fun reportCustomEvent(eventId: Int) {}',
    'internal\n@JvmStatic\nfun reportCustomEvent(eventId: Int) {}',
    '@Suppress("x") internal fun reportCustomEvent(eventId: Int) {}',
  ])('drops one whose modifier is shielded by an annotation: %s', (source) => {
    expect(readBridgeSignatures(source)).toEqual([]);
  });

  it('still reads one that is only annotated, with no modifier', () => {
    expect(readBridgeSignatures('@JvmStatic\nfun reportCustomEvent(eventId: Int) {}')).toEqual([
      'reportCustomEvent(Int)',
    ]);
  });
});

describe('declaresPublishedObject', () => {
  it('accepts a bare declaration, which Kotlin defaults to public', () => {
    expect(
      declaresPublishedObject({ source: 'object KeewanoCodegen {', name: 'KeewanoCodegen' }),
    ).toBe(true);
  });

  it('accepts one written as public', () => {
    expect(
      declaresPublishedObject({ source: 'public object KeewanoCodegen {', name: 'KeewanoCodegen' }),
    ).toBe(true);
  });

  it.each(['internal', 'private', 'protected'])('refuses one narrowed to %s', (modifier) => {
    expect(
      declaresPublishedObject({
        source: `${modifier} object KeewanoCodegen {`,
        name: 'KeewanoCodegen',
      }),
    ).toBe(false);
  });

  it('refuses one that survives only in a comment', () => {
    expect(
      declaresPublishedObject({ source: '/* object KeewanoCodegen */', name: 'KeewanoCodegen' }),
    ).toBe(false);
  });

  it('refuses one whose modifier is shielded by an annotation', () => {
    expect(
      declaresPublishedObject({
        source: 'internal @Deprecated object KeewanoCodegen {',
        name: 'KeewanoCodegen',
      }),
    ).toBe(false);
  });

  it('does not match a longer name that starts the same', () => {
    expect(
      declaresPublishedObject({ source: 'object KeewanoCodegenExtra {', name: 'KeewanoCodegen' }),
    ).toBe(false);
  });
});
