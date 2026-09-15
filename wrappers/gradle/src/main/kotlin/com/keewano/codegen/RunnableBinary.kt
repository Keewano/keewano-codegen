package com.keewano.codegen

import java.io.File

/**
 * Whether this build can start `file`, granting the execute bit if that helps.
 *
 * Granting is not proving. On a filesystem mounted `noexec` the chmod is
 * accepted and the file still cannot be started, so a caller that reads the
 * chmod's own answer concludes the artifact is runnable and skips the copy that
 * would have worked. Asked again afterwards, `canExecute` reports the mount as
 * well as the mode bits.
 */
private fun executableNow(file: File, makeExecutable: (File) -> Boolean): Boolean =
    file.canExecute() || (makeExecutable(file) && file.canExecute())

/**
 * The executable this build can actually start.
 *
 * A Maven artifact arrives without the execute bit, because the format does
 * not record one. Setting it on the cached file is the cheap fix and sticks
 * for every later build - but the dependency cache can be shared or mounted
 * read-only (Gradle's own relocated-cache setup), and there the chmod fails
 * even though resolution succeeded. Then the file is copied into the task's
 * own directory, once per artifact: the copy is skipped while its size still
 * matches, which holds for as long as the resolved artifact does, since a
 * published artifact never changes under its coordinates.
 */
internal fun runnableBinary(
    resolved: File,
    temporaryDir: File,
    /** Injected so the refusal branch is testable; a real refusal needs a filesystem mounted read-only. */
    makeExecutable: (File) -> Boolean = { file -> file.setExecutable(true) },
): File {
    if (executableNow(resolved, makeExecutable)) return resolved
    val copy = File(temporaryDir, resolved.name)
    if (copy.length() != resolved.length()) resolved.copyTo(copy, overwrite = true)
    if (!executableNow(copy) { file -> file.setExecutable(true) }) {
        error("keewano-codegen: ${copy.path} cannot be made executable")
    }
    return copy
}
