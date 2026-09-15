package com.keewano.codegen

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * The mapping is the whole function, so the table below is the whole test: the
 * five pairs real JVMs report on machines we publish for, the one documented
 * fallback, and the pairs that used to resolve somebody else's executable.
 */
class HostClassifierTest {
    @Test
    fun `resolves the published executable for each supported host`() {
        assertEquals("macos-arm64", hostClassifier("Mac OS X", "aarch64"))
        assertEquals("macos-x64", hostClassifier("Mac OS X", "x86_64"))
        assertEquals("windows-x64", hostClassifier("Windows 11", "amd64"))
        assertEquals("linux-x64", hostClassifier("Linux", "amd64"))
        assertEquals("linux-arm64", hostClassifier("Linux", "aarch64"))
    }

    @Test
    fun `windows on arm takes the x64 executable, the documented fallback`() {
        assertEquals("windows-x64", hostClassifier("Windows 11", "aarch64"))
    }

    @Test
    fun `a host we publish nothing for fails naming both values as reported`() {
        /**
         * Each of these used to resolve a wrong executable: the BSDs and SunOS
         * took linux-x64 through the arch-only branch, and 32-bit Windows took
         * the 64-bit build through the os-only one.
         */
        val unsupported = listOf(
            "FreeBSD" to "amd64",
            "NetBSD" to "amd64",
            "OpenBSD" to "amd64",
            "SunOS" to "amd64",
            "Windows 10" to "x86",
            "AIX" to "ppc64",
        )
        for ((osName, osArch) in unsupported) {
            val failure = assertFailsWith<IllegalStateException> { hostClassifier(osName, osArch) }
            assertTrue(failure.message!!.contains("$osName/$osArch"), failure.message)
        }
    }

    @Test
    fun `the property-reading caller resolves this build host`() {
        /**
         * Whatever machine runs the suite is one we publish for, so the caller
         * must succeed here - which is the one thing the pure table cannot
         * cover: a typo in a property name.
         */
        assertTrue(hostClassifier().isNotEmpty())
    }

    @Test
    fun `matching survives a locale whose case folding differs`() {
        val previous = java.util.Locale.getDefault()
        java.util.Locale.setDefault(java.util.Locale.forLanguageTag("tr-TR"))
        try {
            assertEquals("windows-x64", hostClassifier("WINDOWS 11", "amd64"))
        } finally {
            java.util.Locale.setDefault(previous)
        }
    }
}
