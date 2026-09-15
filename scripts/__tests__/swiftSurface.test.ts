type Surface = { properties: string[]; initializers: string[]; bridge: string[] };

const { assertRead, declaresType, readDeclarations } = require('../lib/swiftSurface.cjs') as {
  assertRead: (args: { surface: Surface; path: string }) => void;
  declaresType: (args: { source: string; name: string }) => boolean;
  readDeclarations: (source: string) => Surface;
};

const SET = [
  'public struct KeewanoCustomEventSet {',
  '    public let version: UInt32',
  '    public init(version: UInt32) {}',
  '}',
  'public enum KeewanoCodegen {',
  '    public static func reportCustomEvent(_ eventId: Int) {}',
  '}',
].join('\n');

describe('readDeclarations', () => {
  it('reads the property, the initializer and the overload', () => {
    const read = readDeclarations(SET);
    expect(read.properties).toEqual(['version: UInt32']);
    expect(read.initializers).toHaveLength(1);
    expect(read.bridge).toEqual(['reportCustomEvent(_:Int)']);
  });

  it('reads nothing out of declarations left as line comments', () => {
    const commented = SET.split('\n')
      .map((line) => (line.trim().startsWith('public ') ? `// ${line.trim()}` : line))
      .join('\n');
    const read = readDeclarations(commented);
    expect(read.properties).toEqual([]);
    expect(read.bridge).toEqual([]);
  });

  it('reads nothing out of declarations left inside a block comment', () => {
    const read = readDeclarations(`/*\n${SET}\n*/`);
    expect(read.properties).toEqual([]);
    expect(read.initializers).toEqual([]);
    expect(read.bridge).toEqual([]);
  });

  it('drops a trailing comment from a property type', () => {
    const read = readDeclarations('    public let version: UInt32  // the hash\n');
    expect(read.properties).toEqual(['version: UInt32']);
  });
});

describe('assertRead', () => {
  const full = (): Surface => readDeclarations(SET);

  it('accepts a surface where every kind was read', () => {
    expect(() => assertRead({ surface: full(), path: 'x.swift' })).not.toThrow();
  });

  it.each(['properties', 'initializers', 'bridge'] as const)(
    'refuses a surface whose %s read as empty, and names it',
    (kind) => {
      const surface = { ...full(), [kind]: [] };
      expect(() => assertRead({ surface, path: 'x.swift' })).toThrow(kind);
    },
  );

  it('refuses an initializer the pattern stopped matching, which agrees with everything', () => {
    const spelled = SET.replace('public init(', 'public required init(');
    const surface = readDeclarations(spelled);
    expect(surface.initializers).toEqual([]);
    expect(() => assertRead({ surface, path: 'x.swift' })).toThrow('initializers');
  });
});

describe('declaresType', () => {
  it('finds a type in each form Swift allows', () => {
    for (const form of ['struct', 'class', 'enum', 'actor']) {
      expect(declaresType({ source: `public ${form} KeewanoThing {}`, name: 'KeewanoThing' })).toBe(
        true,
      );
    }
  });

  it('does not count a type named only in a comment', () => {
    expect(declaresType({ source: '// struct KeewanoThing {}', name: 'KeewanoThing' })).toBe(false);
  });

  it('refuses a bare declaration, which Swift defaults to internal', () => {
    expect(declaresType({ source: 'struct KeewanoThing {}', name: 'KeewanoThing' })).toBe(false);
  });

  it.each(['internal', 'private', 'fileprivate'])('refuses a %s declaration', (modifier) => {
    expect(
      declaresType({ source: `${modifier} struct KeewanoThing {}`, name: 'KeewanoThing' }),
    ).toBe(false);
  });

  it.each([
    'open class KeewanoThing {}',
    'final public class KeewanoThing {}',
    '@frozen public struct KeewanoThing {}',
  ])('accepts a published spelling: %s', (source) => {
    expect(declaresType({ source, name: 'KeewanoThing' })).toBe(true);
  });

  it('does not match a longer name that starts the same', () => {
    expect(declaresType({ source: 'struct KeewanoThingExtra {}', name: 'KeewanoThing' })).toBe(
      false,
    );
  });
});
