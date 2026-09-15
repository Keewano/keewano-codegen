"""Run the executable that shipped inside this wheel.

Every argument is passed through untouched and the exit status is returned as it
came back, because the contract a caller relies on belongs to the generator, not
to this wrapper. Adding a flag here, or rewriting an exit code, would make the
Python entry point disagree with the same tool invoked any other way.
"""

import atexit
import os
import shutil
import stat
import subprocess
import sys
import tempfile
from hashlib import blake2b
from pathlib import Path
from typing import Callable

#: Name of the executable inside the wheel. One per wheel: a wheel is built for
#: one platform, so there is never a choice to make at run time.
_EXECUTABLE = "keewano-codegen.exe" if sys.platform == "win32" else "keewano-codegen"

#: Exit status for a wheel this wrapper cannot run. The generator's own INTERNAL,
#: reused rather than invented: the contract belongs to the tool, and a launcher
#: answering outside it would make the command mean one thing through the wheel
#: and another everywhere else. What separates "never started" from "said no" is
#: the message on stderr, not the code.
_CANNOT_RUN = 3

#: Exit status a shell reports for a process killed by SIGINT.
_INTERRUPTED = 130

#: How much of the installed file is read at a time while fingerprinting it.
_READ_BLOCK = 1024 * 1024


def _executable_path() -> Path:
    return Path(__file__).resolve().parent / "_bin" / _EXECUTABLE


def _grant_execute_bit(path: Path) -> bool:
    """Add the execute bit, reporting refusal rather than raising.

    A wheel records file modes, but not every tool that repacks or copies one
    preserves them. Setting the bit is the cheap fix and sticks for every later
    run - except where the caller does not own the file, which is the ordinary
    case for a pip install into a root-owned site-packages and a process running
    as somebody else. There the chmod is refused, and refusing is information,
    not a failure to report as a traceback out of the launcher.
    """
    try:
        mode = path.stat().st_mode
    except OSError:
        return False
    wanted = mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
    if mode == wanted:
        return True
    try:
        path.chmod(wanted)
    except OSError:
        return False
    return True


def _executable_now(path: Path, grant: Callable[[Path], bool]) -> bool:
    """Whether this process can start `path`, granting the bit if that helps.

    Granting is not proving. On a filesystem mounted `noexec` the chmod is
    accepted and the file still cannot be started, so a caller reading the
    chmod's own answer concludes the file is runnable and skips the recovery
    that would have worked. Asked afterwards, `access` reports the mount as
    well as the mode bits, and the recovery runs.
    """
    if os.access(path, os.X_OK):
        return True
    return grant(path) and os.access(path, os.X_OK)


def _private_directory() -> Path:
    """A directory for this run alone, removed when the run ends.

    Nothing here is reused, so the copy inside it - the whole generator, tens
    of megabytes - would otherwise be left behind once per invocation. A local
    user holding the reusable name below makes this the ordinary path rather
    than the exception, which is the case that must not accumulate.
    """
    directory = Path(tempfile.mkdtemp(prefix="keewano-codegen-"))
    atexit.register(shutil.rmtree, directory, ignore_errors=True)
    return directory


def _owned_directory() -> Path:
    """A directory to stage the copy in that nobody else can have prepared.

    The staged file is executed, and the system temporary directory is shared
    and world-writable, so a predictable path there can be created by another
    user first and the copy would land inside something they control. The name
    is still predictable - reusing it is what keeps the copy from being remade
    on every run - but it is trusted only when it is a real directory, owned by
    this user, that nobody else can write to. Read with `lstat`, so a symlink
    aimed at somebody else's directory is judged as the symlink it is. Anything
    else gets a fresh private directory instead of an argument about ownership.
    """
    candidate = Path(tempfile.gettempdir()) / f"keewano-codegen-{os.getuid()}"
    try:
        candidate.mkdir(mode=0o700, parents=True, exist_ok=True)
        info = candidate.lstat()
        owned = stat.S_ISDIR(info.st_mode) and info.st_uid == os.getuid()
        private = not info.st_mode & (stat.S_IWGRP | stat.S_IWOTH)
        if owned and private:
            return candidate
    except OSError:
        pass
    return _private_directory()


def _discard_superseded(directory: Path, name: str, keep: Path) -> None:
    """Remove the copies this one replaced.

    The directory is reused for as long as the user exists, so without this
    every install that ever landed here leaves a whole generator behind - tens
    of megabytes each, and nothing else would ever remove them.

    Unlinking a file another process is executing is safe: a running program
    holds the inode, not the name. A copy that cannot be removed is not a
    reason to refuse to run, so a refusal only costs the space it was already
    costing.
    """
    for stale in directory.glob(f"{name}-*"):
        if stale == keep:
            continue
        try:
            stale.unlink()
        except OSError:
            pass


def _fingerprint(path: Path) -> str:
    """What the installed file contains, as an identity for the copy of it.

    The whole file, because nothing cheaper is honest. Metadata cannot settle
    it: a replacement of the same size keeps the inode when the freed one is
    handed straight back, and the timestamps tie whenever both writes land
    inside the filesystem's granularity. Neither can the two ends: the
    generator is a runtime with our bundle appended, so the bundle sits in the
    last percent of the file and a change anywhere but its tail leaves both
    ends identical - an ordinary same-length edit to a message was measured
    producing a byte-identical size and edge digest.

    It costs a few hundred milliseconds on a file this size, paid only where
    the installed executable could not be run in place, which is the case this
    whole path exists for. Reading a stale generator would cost a build that
    silently generates against the previous version.
    """
    digest = blake2b(digest_size=16)
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(_READ_BLOCK), b""):
            digest.update(block)
    return digest.hexdigest()


def _staged_copy(path: Path, directory: Path) -> Path:
    """A copy of `path` in `directory` that a concurrent run cannot corrupt.

    The name carries which build this is a copy of, because the directory
    outlives any one install: keyed on the file name alone, an upgrade that
    happens to produce the same byte count keeps running the executable it
    replaced, with nothing anywhere to notice.

    Written under a name only this process uses, then moved into place. Copying
    onto the shared name truncates it, so a concurrent invocation executes a
    partial file - and writing to the file that invocation is already running
    is refused outright. A rename is atomic, and a process executing the copy
    it replaces keeps the one it started.
    """
    copy = directory / f"{path.name}-{_fingerprint(path)}"
    if copy.exists():
        return copy
    # The leading dot keeps a half-written file out of the sweep below, so a
    # second invocation staging its own copy is never the one removed.
    staging = copy.with_name(f".{copy.name}.{os.getpid()}")
    try:
        shutil.copyfile(path, staging)
        staging.chmod(0o700)
        os.replace(staging, copy)
    except OSError:
        staging.unlink(missing_ok=True)
        raise
    _discard_superseded(directory, path.name, copy)
    return copy


def _runnable_executable(
    path: Path,
    grant: Callable[[Path], bool] = _grant_execute_bit,
) -> Path:
    """The executable this process can actually start.

    Mirrors what the Gradle wrapper does with a Maven artifact that arrives
    without the bit: set it where that is allowed, and where the file still
    cannot be started, copy into a directory this process owns and run the copy.

    `grant` is injected so the refusal branch is testable: producing a real one
    needs a file owned by another user, or a read-only mount.
    """
    if os.name == "nt":
        return path
    if _executable_now(path, grant):
        return path

    copy = _staged_copy(path, _owned_directory())
    if not _executable_now(copy, grant):
        raise PermissionError(f"{copy} cannot be made executable either")
    return copy


def _finished(status: int) -> int:
    """The exit status a caller should see for a child that has ended.

    A child killed by a signal is reported as that signal negated, which an
    exit status cannot carry - a generator stopped by SIGTERM would leave as
    241. Named the way a shell names it, so passing the status through keeps
    meaning what the module docstring says it means.
    """
    return status if status >= 0 else 128 - status


def main() -> int:
    executable = _executable_path()
    if not executable.exists():
        print(
            f"keewano-codegen: the bundled executable is missing from {executable.parent}, "
            "so this wheel was built wrong - reinstall the package",
            file=sys.stderr,
        )
        return _CANNOT_RUN
    # Resolved twice at most. The staged copy sits in a directory this user's
    # other invocations share, and each of those removes the copies an upgrade
    # superseded - which can take the one this run just resolved, in the moment
    # between resolving it and starting it. Staging it again is the whole
    # answer, and costs a copy that only an upgrade mid-run ever pays for.
    for retry in (True, False):
        try:
            runnable = _runnable_executable(executable)
        except OSError as error:
            print(
                f"keewano-codegen: {executable} is not executable and no runnable copy could be "
                f"made - {error}",
                file=sys.stderr,
            )
            return _CANNOT_RUN
        try:
            return _finished(subprocess.call([str(runnable), *sys.argv[1:]]))
        except FileNotFoundError:
            if retry:
                continue
            print(
                f"keewano-codegen: {runnable} was removed before it could be started",
                file=sys.stderr,
            )
            return _CANNOT_RUN
        except OSError as error:
            print(
                f"keewano-codegen: {runnable} could not be started - {error}",
                file=sys.stderr,
            )
            return _CANNOT_RUN
        except KeyboardInterrupt:
            # Ctrl-C reached the child as well, and it is the child's run being
            # abandoned. Answered the way a shell answers it, rather than with
            # a traceback pointing at this launcher.
            return _INTERRUPTED
    return _CANNOT_RUN


if __name__ == "__main__":
    raise SystemExit(main())
