package com.keewano.codegen

import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations
import javax.inject.Inject

/**
 * Runs the generator over the definitions file for the kotlin target.
 *
 * The inputs and outputs are declared so Gradle can skip the task when nothing
 * changed, which is what makes generating on every build acceptable: the
 * executable is a hundred megabytes and a build that ran it needlessly would be
 * noticed. The generator is idempotent anyway - it rewrites nothing when the text
 * would be the same - but Gradle cannot know that without being told what the
 * task reads and writes.
 *
 * The generator is handed directories and names the files itself; the two
 * outputs are declared by file because that is how Gradle tracks them, and the
 * directories passed on are their parents, so the pair cannot disagree.
 *
 * A project with no definitions file clears its outputs rather than failing:
 * this task joins every build, so a validation error here would break a project
 * the moment it applied the plugin, before its first event exists. The file is
 * `@Internal` and tracked through a file collection because `@InputFile` refuses
 * an absent file outright - and absent must stay distinct from a file declaring
 * no events, which is a real state (the last event was removed) whose build must
 * regenerate the empty module, not keep the old one. Anything else at the path -
 * the folder of per-event files this tool used to read - is handed to the
 * generator, which refuses it with the file it should become.
 */
abstract class KeewanoGenerateTask : DefaultTask() {
    @get:InputFile
    abstract val executable: RegularFileProperty

    @get:Internal
    abstract val definitions: RegularFileProperty

    @get:InputFiles
    abstract val definitionFiles: ConfigurableFileCollection

    @get:OutputFile
    abstract val output: RegularFileProperty

    /** Declared as an output so a deleted asset brings the task back. */
    @get:OutputFile
    abstract val asset: RegularFileProperty

    @get:Inject
    abstract val exec: ExecOperations

    @TaskAction
    fun generate() {
        /**
         * No definitions file means no outputs, not a skip: a skipped task
         * would leave the module and asset of whatever state came before -
         * checking out a branch from before the file existed would still
         * compile the other branch's reporters. Deleting them is how the build
         * mirrors "there are no definitions", the same shape SPM gets for free
         * by declaring no command.
         */
        if (!definitions.get().asFile.exists()) {
            removeOutput(output.get().asFile)
            removeOutput(asset.get().asFile)
            return
        }

        val binary = runnableBinary(executable.get().asFile, temporaryDir)

        exec.exec {
            commandLine(
                binary.path,
                "--input", definitions.get().asFile.path,
                "--target", TARGET,
                "--code", output.get().asFile.parentFile.path,
                "--asset", asset.get().asFile.parentFile.path,
            )
        }
    }
}

/** A stale output that cannot be removed keeps compiling; that is a failure, not a shrug. */
private fun removeOutput(file: java.io.File) {
    if (file.exists() && !file.delete()) {
        error("keewano-codegen: cannot remove stale ${file.path}")
    }
}
