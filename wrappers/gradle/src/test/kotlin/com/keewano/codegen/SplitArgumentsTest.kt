package com.keewano.codegen

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `--args` reaches the task as one string and must reach the generator as the
 * command line the developer typed. The case that forced a real tokenizer is a
 * quoted path with a space: a plain split handed it over in pieces.
 */
class SplitArgumentsTest {
    @Test
    fun `splits an ordinary command line on spaces`() {
        assertEquals(
            listOf("EnemyKilled", "--type", "string"),
            splitArguments(listOf("EnemyKilled --type string")),
        )
    }

    @Test
    fun `keeps a quoted path with a space as one token, without the quotes`() {
        assertEquals(
            listOf("Foo", "--type", "none", "--config", "/home/j doe/keewano.json"),
            splitArguments(listOf("Foo --type none --config \"/home/j doe/keewano.json\"")),
        )
    }

    @Test
    fun `flattens repeated --args occurrences in order`() {
        assertEquals(
            listOf("Foo", "--type", "uint"),
            splitArguments(listOf("Foo", "--type uint")),
        )
    }

    @Test
    fun `drops blank input rather than passing empty tokens`() {
        assertEquals(emptyList(), splitArguments(listOf("", "   ")))
    }
}
