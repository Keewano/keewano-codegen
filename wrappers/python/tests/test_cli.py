"""The launcher's recovery, which nothing else exercises.

A wheel can arrive without the execute bit, and where site-packages belongs to
another user the chmod is refused - the case the copy fallback exists for.
Producing a real refusal needs a file owned by somebody else or a read-only
mount, so the grant is injected, exactly as the Gradle wrapper's test does.
Everything after the refusal is real: the copy, its bytes, its bit, its reuse.

Skipped on Windows, where there is no execute bit and the launcher hands back
the installed path without asking.
"""

import io
import os
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from keewano_codegen.cli import (
    _executable_now,
    _grant_execute_bit,
    _runnable_executable,
    _staged_copy,
    main,
)

posix_only = unittest.skipIf(
    os.name == "nt",
    "on Windows the launcher runs the installed file as is",
)

#: A grant that refuses, which is what a root-owned site-packages does.
REFUSE = lambda _: False  # noqa: E731

#: A grant that reports success and changes nothing, which is what a filesystem
#: mounted noexec does: the mode bits are accepted and the file still cannot be
#: started.
GRANT_WITHOUT_EFFECT = lambda _: True  # noqa: E731


def _artifact(directory, text="payload"):
    """An installed executable that lost its bit, as a repacked wheel leaves it."""
    file = Path(directory) / "keewano-codegen"
    file.write_text(text)
    file.chmod(0o644)
    return file


class GrantExecuteBit(unittest.TestCase):
    def test_a_refused_chmod_is_reported_rather_than_raised(self):
        """The whole point of the seam: a refusal is information, not a traceback."""
        with TemporaryDirectory() as directory:
            file = _artifact(directory)
            with patch.object(Path, "chmod", side_effect=PermissionError(1, "nope")):
                self.assertFalse(_grant_execute_bit(file))

    def test_a_missing_file_is_reported_rather_than_raised(self):
        self.assertFalse(_grant_execute_bit(Path("nowhere") / "keewano-codegen"))


class ExecutableNow(unittest.TestCase):
    @posix_only
    def test_a_grant_that_changed_nothing_is_not_trusted(self):
        """Granting is not proving.

        The chmod is accepted on a noexec mount and the file still cannot be
        started, so reading the chmod's own answer skips the recovery that
        would have worked.
        """
        with TemporaryDirectory() as directory:
            file = _artifact(directory)
            self.assertFalse(_executable_now(file, GRANT_WITHOUT_EFFECT))

    @posix_only
    def test_a_grant_that_took_is_trusted(self):
        with TemporaryDirectory() as directory:
            file = _artifact(directory)
            self.assertTrue(_executable_now(file, _grant_execute_bit))


class RunnableExecutable(unittest.TestCase):
    @posix_only
    def test_a_refused_grant_leaves_the_install_alone_and_runs_a_copy(self):
        with TemporaryDirectory() as directory:
            file = _artifact(directory)
            chosen = _runnable_executable(file, REFUSE)
            self.assertNotEqual(file, chosen, "the installed file must not be the one run")
            self.assertTrue(os.access(chosen, os.X_OK), "the copy must be runnable")
            self.assertEqual("payload", chosen.read_text())

    @posix_only
    def test_a_grant_that_changed_nothing_also_copies(self):
        """The shape the thread reported: the bit is set and the file still refuses."""
        with TemporaryDirectory() as directory:
            file = _artifact(directory)
            chosen = _runnable_executable(file, GRANT_WITHOUT_EFFECT)
            self.assertNotEqual(file, chosen, "a granted bit that did not take must not be trusted")
            self.assertTrue(os.access(chosen, os.X_OK))


class StagedCopy(unittest.TestCase):
    @posix_only
    def test_the_copy_is_reused_while_the_build_is_the_same(self):
        """Equal paths prove nothing on their own - both are computed the same
        way - so the copy is back-dated and the stamp has to survive."""
        with TemporaryDirectory() as install, TemporaryDirectory() as staging:
            file = _artifact(install)
            first = _staged_copy(file, Path(staging))
            stamp = first.stat().st_mtime - 60
            os.utime(first, (stamp, stamp))
            second = _staged_copy(file, Path(staging))
            self.assertEqual(first, second)
            self.assertEqual(
                stamp,
                second.stat().st_mtime,
                "an unchanged install must not be recopied",
            )

    @posix_only
    def test_a_different_build_gets_its_own_copy(self):
        """Keyed on the name alone, an upgrade keeps running what it replaced."""
        with TemporaryDirectory() as install, TemporaryDirectory() as staging:
            file = _artifact(install)
            first = _staged_copy(file, Path(staging))
            file.write_text("a longer payload than before")
            second = _staged_copy(file, Path(staging))
            self.assertNotEqual(first, second, "a replaced install must not reuse the old copy")
            self.assertEqual("a longer payload than before", second.read_text())

    @posix_only
    def test_a_replacement_of_the_same_size_is_not_reused(self):
        """The tie no metadata can break.

        An upgrade that weighs exactly what it replaced keeps the inode when
        the freed one is handed straight back, and its timestamps tie whenever
        both writes land inside the filesystem's granularity. Only the bytes
        separate them, and reusing the copy runs the previous version.
        """
        with TemporaryDirectory() as install, TemporaryDirectory() as staging:
            file = _artifact(install, "payload")
            first = _staged_copy(file, Path(staging))
            file.write_text("PAYLOAD")
            second = _staged_copy(file, Path(staging))
            self.assertNotEqual(first, second, "a same-size replacement must not reuse the copy")
            self.assertEqual("PAYLOAD", second.read_text())

    @posix_only
    def test_a_change_away_from_both_ends_is_not_missed(self):
        """The shape the real executable has.

        The generator is a runtime with our bundle appended, so the bundle
        sits in the last percent of the file and most of a change to it lands
        nowhere near either end. A fingerprint that reads only the ends runs
        the copy of the version it replaced, which was measured on two real
        builds that differed by one same-length message.
        """
        with TemporaryDirectory() as install, TemporaryDirectory() as staging:
            file = Path(install) / "keewano-codegen"
            body = bytearray(512 * 1024)
            file.write_bytes(bytes(body))
            file.chmod(0o644)
            first = _staged_copy(file, Path(staging))
            body[len(body) // 2] = 1
            file.write_bytes(bytes(body))
            second = _staged_copy(file, Path(staging))
            self.assertNotEqual(first, second, "a change far from both ends must not be missed")

    @posix_only
    def test_the_copies_it_replaced_are_removed(self):
        """The directory is reused for the life of the user.

        Every install that lands here leaves a whole generator behind, so
        without a sweep three upgrades cost three copies of it.
        """
        with TemporaryDirectory() as install, TemporaryDirectory() as staging:
            file = _artifact(install)
            _staged_copy(file, Path(staging))
            file.write_text("a second install, of another size")
            _staged_copy(file, Path(staging))
            file.write_text("third")
            kept = _staged_copy(file, Path(staging))
            self.assertEqual(
                [kept.name],
                sorted(entry.name for entry in Path(staging).iterdir()),
                "only the copy in use may survive",
            )


class Main(unittest.TestCase):
    def test_a_missing_executable_is_named_rather_than_raised(self):
        """A source checkout has no _bin, which is the same shape as a bad wheel."""
        stderr = io.StringIO()
        with redirect_stderr(stderr):
            self.assertEqual(3, main())
        self.assertIn("reinstall the package", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
