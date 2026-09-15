package com.keewano.codegen

/**
 * The classifier of the artifact this machine can run.
 *
 * Read from the JVM rather than from a property, because the answer is a fact
 * about the machine and not a choice: a build that resolved the wrong one would
 * download a working executable for somebody else's operating system and fail on
 * the first line of the task.
 */
internal fun hostClassifier(): String =
    hostClassifier(System.getProperty("os.name"), System.getProperty("os.arch"))

/**
 * Every row names one (os, arch) pair, and an unnamed pair fails with both
 * values rather than taking the closest row: the case that made this worth
 * writing was FreeBSD resolving a Linux executable and failing only at
 * execution time, where nothing mentions the operating system.
 *
 * Each row carries one arch spelling because `os.arch` is a constant compiled
 * into the JDK, one per target: `x86_64` reaches us only from a macOS build and
 * `amd64` from every other, so a second alternative on a row is a branch no JVM
 * can produce and no test can refute.
 *
 * The no-arg `lowercase()` folds by Locale.ROOT, which is what keeps
 * "Windows 11" matching under a Turkish default locale; `toLowerCase()` would
 * fold the I to a dotless one there and miss.
 */
internal fun hostClassifier(osName: String, osArch: String): String {
    val os = osName.lowercase()
    val arch = osArch.lowercase()
    return when {
        os.startsWith("mac") && arch == "aarch64" -> "macos-arm64"
        os.startsWith("mac") && arch == "x86_64" -> "macos-x64"
        os.startsWith("windows") && arch == "amd64" -> "windows-x64"
        /**
         * Reached only by a JVM built for ARM64 - an emulated x64 JVM reports
         * amd64 and takes the row above. The x64 executable runs under the
         * emulation Windows 11 ships; the limit is Windows 10 on ARM, which
         * emulates x86 only, so there it fails to start. A native windows-arm64
         * executable stays unpublished until the pipeline can execute one.
         */
        os.startsWith("windows") && arch == "aarch64" -> "windows-x64"
        os.startsWith("linux") && arch == "amd64" -> "linux-x64"
        /**
         * The classifier picks the executable for the machine running
         * Gradle, not for any device the app ships to, so this is about
         * which hosts build. A container on an Apple Silicon Mac
         * defaults to linux/aarch64, and arm64 CI runners are the same
         * story; without this row both fail by name at configuration
         * time on a platform we do publish for.
         */
        os.startsWith("linux") && arch == "aarch64" -> "linux-arm64"
        else -> error(
            "keewano-codegen publishes no executable for $osName/$osArch, so the generator cannot run here",
        )
    }
}
