import PackagePlugin
import Foundation

/// Runs the generator's own commands - `add`, `edit`, `remove` - from a Swift
/// package.
///
/// Every argument is handed over untouched. The contract a caller relies on
/// belongs to the generator, and a plugin that renamed a flag or rewrote an exit
/// code would make the same tool answer differently depending on how it was
/// reached.
///
/// A command plugin rather than part of the build-tool one, because these write
/// the definitions file in the package directory and a build must not: SPM asks the
/// developer for that permission once, per invocation, which is the right moment
/// for a command somebody typed and the wrong one for a build.
@main
struct KeewanoCodegenCommand: CommandPlugin {
    func performCommand(context: PluginContext, arguments: [String]) throws {
        let tool = try context.tool(named: "keewano-codegen")
        let process = Process()
        process.executableURL = URL(fileURLWithPath: tool.path.string)
        process.arguments = arguments
        // The package directory, so the default `keewano.events.json` means what
        // it means everywhere else. A plugin runs in a working directory of SPM's
        // choosing, and without this the tool would look for definitions where
        // nobody put them.
        process.currentDirectoryURL = URL(fileURLWithPath: context.package.directory.string)
        try process.run()
        process.waitUntilExit()
        if process.terminationStatus != 0 {
            throw KeewanoCodegenError.failed(status: process.terminationStatus)
        }
    }
}

enum KeewanoCodegenError: Error, CustomStringConvertible {
    case failed(status: Int32)

    var description: String {
        switch self {
        case let .failed(status):
            return "keewano-codegen exited with \(status)"
        }
    }
}
