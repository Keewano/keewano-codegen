package com.keewano.codegen

import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.options.Option
import org.gradle.process.ExecOperations
import javax.inject.Inject

/**
 * Runs one of the generator's own commands - `add`, `edit`, `remove` - so an
 * Android project declares an event without opening the definitions file or
 * knowing its shape.
 *
 * Deliberately not cacheable and never up to date. Generation is a function of
 * the definitions and Gradle can skip it; these commands are the thing that
 * changes the definitions, so a run Gradle decided to skip would silently do
 * nothing on the one invocation somebody typed on purpose.
 */
abstract class KeewanoEventTask : DefaultTask() {
    @get:InputFile
    abstract val executable: RegularFileProperty

    @get:Internal
    abstract val definitions: RegularFileProperty

    /** The command word this task runs, fixed when the task is registered. */
    @get:Input
    abstract val command: Property<String>

    /**
     * Everything after the command word, exactly as typed. Passed through
     * untouched: the flags belong to the generator, and a plugin that renamed one
     * would make the same tool answer differently depending on how it was
     * reached.
     */
    @get:Input
    @get:Option(
        option = "args",
        description = "Arguments for the command, for example: --args=\"Score --type uint\"",
    )
    abstract val arguments: ListProperty<String>

    @get:Inject
    abstract val exec: ExecOperations

    init {
        outputs.upToDateWhen { false }
    }

    @TaskAction
    fun run() {
        val binary = runnableBinary(executable.get().asFile, temporaryDir)
        /**
         * `add` creates the file when there is none - the first `keewanoAdd` is
         * how a project gets one - but not the directory above it: on the command
         * line a mistyped --input would silently fork the definitions. Here the
         * path is configuration, not typing, so the directory is the task's to
         * create.
         */
        definitions.get().asFile.parentFile.mkdirs()
        exec.exec {
            commandLine(
                listOf(binary.path, command.get()) + splitArguments(arguments.get()) +
                    listOf("--input", definitions.get().asFile.path),
            )
        }
    }
}

/**
 * Gradle hands `--args` over as one string, so it is tokenized here rather than
 * passed whole: the generator reads a command line, not a sentence. The
 * tokenizer is the one Gradle's own application plugin runs on its `--args`,
 * so quoting behaves the way a Gradle user already expects - which matters for
 * `--config`, the one flag whose value is a path and may carry a space. A
 * plain split would hand such a path over in pieces.
 */
internal fun splitArguments(raw: List<String>): List<String> =
    raw.flatMap { line ->
        org.apache.tools.ant.types.Commandline.translateCommandline(line).toList()
    }.filter { token -> token.isNotBlank() }
