package com.keewano.codegen

import org.gradle.api.Project
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property

/**
 * What a project configures, and what it does not have to.
 *
 * Every default here matches the generator's own, so a project that keeps its
 * definitions where the tool expects them writes nothing at all. The defaults are
 * repeated rather than asked for at configuration time because Gradle needs them
 * before the executable has been resolved, and resolving a dependency to read a
 * default would download it on every build that never runs the task.
 *
 * There is no target to choose: this plugin exists for the Android SDK, so the
 * generator always runs for the kotlin target. Every other target is the command
 * line's.
 *
 * definitions - the definitions file: every event, in the order that numbers them.
 * code - the directory the generated file goes in. Under the build directory by
 *   default, which is the point of generating during the build: nothing to commit.
 *   The file's name is the generator's, not the project's.
 * asset - the directory the definition-set asset goes in. Android reads it at
 *   launch, so it belongs in the source set the build packages: `src/main/assets`
 *   by default.
 * version - the generator to resolve. Matches the plugin's own by default, so the
 *   two cannot drift apart without somebody saying to.
 */
abstract class KeewanoCodegenExtension(project: Project) {
    abstract val definitions: RegularFileProperty
    abstract val code: DirectoryProperty
    abstract val asset: DirectoryProperty
    abstract val version: Property<String>

    init {
        definitions.convention(project.layout.projectDirectory.file("keewano.events.json"))
        code.convention(project.layout.buildDirectory.dir("generated/keewano/com/keewano/sdk/generated"))
        asset.convention(project.layout.projectDirectory.dir("src/main/assets"))
        version.convention(project.provider { KEEWANO_CODEGEN_VERSION })
    }
}

/** The one target this plugin generates for. */
internal const val TARGET = "kotlin"

/**
 * The names the generator gives the two files it writes for that target. The
 * plugin passes only directories, so these are not a choice made here; they are
 * spelled here because Gradle tracks outputs by file, and the up-to-date check
 * needs the path before the generator has run. The wrapper check compares both
 * files at exactly these paths against the recorded vectors, so a name that
 * moves upstream fails there rather than leaving a stale output in the build.
 */
internal const val GENERATED_FILE_NAME = "KeewanoCustomEvents.Generated.kt"
internal const val ASSET_FILE_NAME = "keewano_custom_events.json"

/**
 * The generator version this plugin was built against. Stamped into both from
 * one place at release time, so a plugin never resolves an executable that
 * disagrees with the contract it was written for.
 */
internal const val KEEWANO_CODEGEN_VERSION = "0.0.0"
