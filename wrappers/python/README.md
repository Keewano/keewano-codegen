# keewano-codegen

Build-time generator for Keewano custom events, for projects that use the Python
SDK. It turns one JSON file of event definitions into the generated module your
SDK imports.

```bash
pip install keewano-codegen
```

Needs no Node and no toolchain: the wheel for your platform carries a
self-contained executable.

```bash
keewano-codegen add EnemyKilled --type string
keewano-codegen --target python --code myapp
```

The first `add` creates `keewano.events.json` in the working directory; the
generate run writes `myapp/keewano_custom_events.py`. An event's id is its
position in the file, so add at the end and never reorder.

`keewano-codegen --help` prints every command and flag. The commands, the flags
and the definitions file are identical to the npm CLI, because both run the same
generator - a project keeps one definitions file and generates for several
platforms from it.

Full documentation, the event-definition format and the source live at
[github.com/Keewano/keewano-codegen](https://github.com/Keewano/keewano-codegen).
