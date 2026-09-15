import PackagePlugin
import Foundation

/// Generates the custom-events module into the build.
///
/// This is what removes the committed generated file. SPM runs the command
/// before compiling the target, feeds it the definitions, and puts the result
/// where the compiler picks it up - so the Swift never lands in the repository,
/// and an event change is a one-line diff in a JSON file.
///
/// The definitions are looked for in `keewano.events.json` at the package
/// root - the tool's own default, and the same file every other wrapper reads.
/// The package root rather than a per-target place, because the commands run
/// against the package: `add` has to write where the build will look.
///
/// A package without that file contributes no command rather than failing.
/// Only a target that opted into this plugin reaches here at all, but a package
/// may add the plugin before its first event exists.
@main
struct KeewanoCodegen: BuildToolPlugin {
    func createBuildCommands(context: PluginContext, target: Target) throws -> [Command] {
        let definitions = context.package.directory.appending("keewano.events.json")
        guard FileManager.default.fileExists(atPath: definitions.string) else { return [] }

        // The generator names the file; the plugin hands it the directory and
        // declares the name it will use, which is what makes the output a
        // source SPM compiles.
        let output = context.pluginWorkDirectory.appending("KeewanoCustomEvents.Generated.swift")

        // Declared as a prebuild command would rerun on every build; this one is
        // a build command precisely so SPM can skip it, and it can only do that
        // if it is told what is read and what is written.
        //
        // The input is the one file, which is the shape SPM tracks well: an
        // edit in place moves its stamp, and so does every add, edit, remove
        // and checkout. Measured back when the definitions were a folder of
        // files, a folder input missed an edit made in place inside one, and
        // per-file inputs left a deleted file in the build database as a
        // dangling node that refused every build until a clean. Neither
        // applies to a file that is edited and never deleted; deleting it means
        // "no events", and the guard above then declares no command at all.
        return [
            .buildCommand(
                displayName: "Generating Keewano custom events for \(target.name)",
                executable: try context.tool(named: "keewano-codegen").path,
                arguments: [
                    "--input", definitions.string,
                    "--target", "swift",
                    "--code", context.pluginWorkDirectory.string,
                ],
                inputFiles: [definitions],
                outputFiles: [output]
            )
        ]
    }
}
