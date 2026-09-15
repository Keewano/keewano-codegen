package com.keewano.codegen

import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * The refusal branch needs a filesystem that rejects chmod, which no test can
 * portably arrange - a read-only directory does not do it, chmod touches the
 * inode - so the refusal is injected. Everything after the refusal is real:
 * the copy, its bytes, its bit, its reuse.
 *
 * The branch-entry tests skip on Windows, where there is no execute bit and
 * `canExecute` is constantly true, so the refusal is unreachable by contract.
 */
class RunnableBinaryTest {
    private val refuse: (File) -> Boolean = { false }

    /**
     * A chmod that reports success and changes nothing, which is what a
     * `noexec` mount does: the mode bits are accepted and the file still
     * cannot be started.
     */
    private val grantWithoutEffect: (File) -> Boolean = { true }

    private fun temp(): File = Files.createTempDirectory("keewano-test").toFile()

    private fun onWindows(): Boolean = System.getProperty("os.name").lowercase().startsWith("windows")

    private fun artifact(): File {
        val file = File(temp(), "keewano-codegen-binary.bin")
        file.writeText("payload")
        file.setExecutable(false)
        return file
    }

    @Test
    fun `an executable artifact is run in place`() {
        val cached = artifact()
        cached.setExecutable(true)
        assertEquals(cached, runnableBinary(cached, temp(), refuse))
    }

    @Test
    fun `a refused chmod leaves the artifact alone and runs a copy`() {
        if (onWindows()) return
        val cached = artifact()
        val work = temp()
        val chosen = runnableBinary(cached, work, refuse)
        assertNotEquals(cached, chosen, "the cached file must not be the one run")
        assertEquals(work, chosen.parentFile)
        assertTrue(chosen.canExecute(), "the copy must be runnable")
        assertEquals("payload", chosen.readText())
    }

    @Test
    fun `a chmod that succeeds without making the file runnable still copies`() {
        if (onWindows()) return
        val cached = artifact()
        val work = temp()
        val chosen = runnableBinary(cached, work, grantWithoutEffect)
        assertNotEquals(cached, chosen, "a granted bit that did not take must not be trusted")
        assertTrue(chosen.canExecute(), "the copy must be runnable")
    }

    @Test
    fun `the copy is reused while its size still matches`() {
        if (onWindows()) return
        val cached = artifact()
        val work = temp()
        val first = runnableBinary(cached, work, refuse)
        val stamp = first.lastModified() - 60_000
        first.setLastModified(stamp)
        val second = runnableBinary(cached, work, refuse)
        assertEquals(first, second)
        assertEquals(stamp, second.lastModified(), "an unchanged artifact must not be recopied")
    }
}
