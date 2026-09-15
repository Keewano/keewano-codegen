const { readBridgeSignatures, snakeCase } = require('../lib/pythonBridge.cjs') as {
  readBridgeSignatures: (source: string) => string[];
  snakeCase: (name: string) => string;
};

const DECLARATION = '    def report_custom_event_str(event_id: int, value: str) -> None:\n';

describe('readBridgeSignatures', () => {
  it('reads a bridge entry point with its parameter types', () => {
    expect(readBridgeSignatures(DECLARATION)).toEqual(['report_custom_event_str(int,str)']);
  });

  it('drops one that survives only in a # comment', () => {
    expect(readBridgeSignatures(`    # ${DECLARATION.trim()}\n`)).toEqual([]);
  });

  it('drops one spelled inside a docstring, which is how the SDK documents its API', () => {
    const source = `class KeewanoCodegen:\n    """Codegen calls:\n${DECLARATION}    """\n`;
    expect(readBridgeSignatures(source)).toEqual([]);
  });

  it('drops one withdrawn behind a leading underscore', () => {
    expect(
      readBridgeSignatures('    def _report_custom_event_str(event_id: int) -> None:\n'),
    ).toEqual([]);
  });

  it('keeps a real declaration that has a docstring below it', () => {
    const source = `${DECLARATION}        """A custom event carrying a string."""\n`;
    expect(readBridgeSignatures(source)).toEqual(['report_custom_event_str(int,str)']);
  });
});

describe('snakeCase parity with the emitter', () => {
  /**
   * The same conversion exists twice - the emitter names the generated
   * wrappers, this library matches them against the reserved list - and
   * scripts cannot load the TypeScript one at runtime. This test can:
   * both implementations run here over every reserved name, the exact
   * inputs the check feeds the conversion, plus the digit and acronym
   * edges - so the two copies cannot drift apart silently.
   */
  const { snakeCase: emitterSnakeCase } = require('../../src/emitters/python/python') as {
    snakeCase: (name: string) => string;
  };
  const { RESERVED_EVENT_NAMES } = require('../../src/events/reservedEventNames') as {
    RESERVED_EVENT_NAMES: ReadonlySet<string>;
  };

  it.each([...RESERVED_EVENT_NAMES, 'Event00', 'USDPrice', 'A00'])(
    'flattens %s the way the emitter names its wrapper',
    (name) => {
      expect(snakeCase(name)).toBe(emitterSnakeCase(name));
    },
  );
});
