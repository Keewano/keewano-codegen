// swift-tools-version:5.9
import PackageDescription

// The generator reaches a Swift project the way SwiftLint and swift-format do,
// because Swift Package Manager offers no other shape: it resolves packages from
// git and has no binary registry, so an executable of this size cannot live in
// the repository and has to be named by URL and checksum instead.
//
// Two plugins, because they answer different questions. The command plugin is
// how somebody declares an event; the build-tool plugin is how the generated file
// stops being committed - it is produced into the build, so an event change is a
// one-line diff in a JSON file rather than several hundred lines of Swift.
let package = Package(
    name: "keewano-codegen",
    products: [
        .plugin(name: "KeewanoCodegen", targets: ["KeewanoCodegen"]),
        .plugin(name: "KeewanoCodegenCommand", targets: ["KeewanoCodegenCommand"]),
    ],
    targets: [
        // Pointed at a checked-out bundle rather than a URL while this is being
        // written: SPM verifies a checksum for a remote bundle and there is
        // nothing published to checksum yet. The release build rewrites this to
        // `url:` and `checksum:`, which is the last step and the one that cannot
        // be proven until something is published.
        .binaryTarget(
            name: "keewano-codegen-binary",
            path: "artifacts/keewano-codegen.artifactbundle"
        ),
        .plugin(
            name: "KeewanoCodegen",
            capability: .buildTool(),
            dependencies: ["keewano-codegen-binary"]
        ),
        .plugin(
            name: "KeewanoCodegenCommand",
            capability: .command(
                intent: .custom(
                    verb: "keewano-codegen",
                    description: "Declare, rename and remove Keewano custom events."
                ),
                // Writing is asked for because the commands write definition
                // files. Generation needs none of this - the build-tool plugin
                // writes into the build directory, which SPM already owns.
                permissions: [
                    .writeToPackageDirectory(
                        reason: "The commands add, rename and remove events in the definitions file."
                    )
                ]
            ),
            dependencies: ["keewano-codegen-binary"]
        ),
    ]
)
