package com.keewano.codegen

import org.gradle.api.Plugin
import org.gradle.api.Project

/**
 * Generates the Keewano custom-events module during the build.
 *
 * The point of running it here rather than by hand is that the generated file
 * stops being something anybody commits: it is produced into the build directory
 * from the definitions, so an event change is a one-line diff in a JSON file
 * instead of several hundred lines nobody can review.
 *
 * The generator is not Kotlin and not the JVM - it is a self-contained executable
 * carrying its own runtime, published as its own artifact per platform. This
 * plugin resolves the one this machine can run and calls it; everything about
 * what it generates belongs to the generator, not here.
 */
class KeewanoCodegenPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val settings = project.extensions.create("keewanoCodegen", KeewanoCodegenExtension::class.java, project)

        /**
         * Its own configuration so the executable resolves like any other
         * dependency - from whatever repositories the consumer already declares,
         * through their cache and their mirror. A plugin that downloaded a URL
         * itself would bypass all of that, and would be the one thing in the
         * build nobody could point at an internal mirror.
         */
        val binaries = project.configurations.create("keewanoCodegen")
        binaries.isCanBeConsumed = false
        binaries.isCanBeResolved = true
        binaries.description = "The Keewano codegen executable for this build host."

        project.dependencies.add(
            binaries.name,
            project.provider {
                "com.keewano:keewano-codegen-binary:${settings.version.get()}:${hostClassifier()}@bin"
            },
        )

        val binary = project.layout.file(project.provider { binaries.singleFile })

        val generate = project.tasks.register("keewanoGenerate", KeewanoGenerateTask::class.java) {
            group = "keewano"
            description = "Generates the custom-events module from the definitions file."
            executable.set(binary)
            definitions.set(settings.definitions)
            definitionFiles.from(settings.definitions)
            output.set(settings.code.file(GENERATED_FILE_NAME))
            asset.set(settings.asset.file(ASSET_FILE_NAME))
        }

        /**
         * Generation joins the build here, not in the consumer's script: the
         * generated file's directory becomes a Kotlin source directory, carried
         * as a provider of the task's own output so every compilation that reads
         * it also runs the task first. Registered only once a Kotlin plugin is
         * applied, which is also what puts the extension's class on this
         * classpath - the reference below stays unloaded until then.
         *
         * The directory is the file's parent rather than a fixed generated
         * root, so a consumer who moves `code` moves the source directory
         * with it; Kotlin does not require packages to mirror directories, so
         * the file compiles from there as it is.
         */
        val generatedDirectory = generate.flatMap { task -> task.output.asFile }.map { file -> file.parentFile }
        for (pluginId in KOTLIN_PLUGIN_IDS) {
            project.plugins.withId(pluginId) {
                project.extensions
                    .getByType(org.jetbrains.kotlin.gradle.dsl.KotlinProjectExtension::class.java)
                    .sourceSets
                    .getByName("main")
                    .kotlin
                    .srcDir(generatedDirectory)
            }
        }

        /**
         * The source directory orders compilation, but the asset is read by
         * Android's merge tasks, not the compiler - left unordered, a task that
         * packages src/main/assets either runs before the asset is rewritten or
         * fails Gradle's producer-consumer validation outright (an undeclared
         * read of this task's output). Every variant task in the Android build
         * runs after `preBuild`, so hanging generation off it orders the asset
         * write ahead of all packaging. Matched by name so the plugin needs no
         * Android classes; a project without the task is untouched.
         */
        for (pluginId in ANDROID_PLUGIN_IDS) {
            project.plugins.withId(pluginId) {
                project.tasks.matching { task -> task.name == "preBuild" }.configureEach { dependsOn(generate) }
            }
        }

        /**
         * One task per command rather than one taking the command as an
         * argument: `gradle tasks` then lists what can be done, and a typo in a
         * command word is refused by Gradle before the executable is resolved.
         */
        for ((task, word) in EVENT_TASKS) {
            project.tasks.register(task, KeewanoEventTask::class.java) {
                group = "keewano"
                description = "Runs `keewano-codegen $word` against the definitions file."
                executable.set(binary)
                definitions.set(settings.definitions)
                command.set(word)
            }
        }
    }
}

/** The task name a developer types, and the command word it runs. */
private val EVENT_TASKS = mapOf(
    "keewanoAdd" to "add",
    "keewanoEdit" to "edit",
    "keewanoRemove" to "remove",
)

/**
 * The Kotlin plugins whose `main` source set the generated directory attaches
 * to. Applying neither leaves `keewanoGenerate` an explicit task, which is all
 * such a project can want from it.
 *
 * Deliberately not multiplatform: KMP has no `main` (attaching would throw
 * during configuration), and the right set there would be `androidMain`, since
 * the generated reporters extend the Android SDK - `commonMain` would break
 * every other target's compilation. A KMP project runs `keewanoGenerate` and
 * places the directory itself.
 */
private val KOTLIN_PLUGIN_IDS = listOf(
    "org.jetbrains.kotlin.android",
    "org.jetbrains.kotlin.jvm",
)

/** The Android plugins whose `preBuild` anchors the asset write before packaging. */
private val ANDROID_PLUGIN_IDS = listOf(
    "com.android.application",
    "com.android.library",
)
