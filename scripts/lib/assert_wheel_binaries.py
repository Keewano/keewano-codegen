"""Each wheel carries the executable it was staged with, and no other.

Packing is not proof. The wheels are built one after another from one staging
directory and tagged afterwards, so a wheel can be produced, tagged and
installed while carrying somebody else's binary - and the driving check only
installs the wheel for the host it runs on, where the wrong binary for another
platform is invisible.

Reads the same table the build reads, passed in rather than repeated here, so
there is no second list to drift. Called as:

    assert_wheel_binaries.py <wheels-dir> <binaries-dir> <binary> <tag> <name> ...
"""

import hashlib
import pathlib
import sys
import zipfile


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def elf_interpreter(image: bytes) -> str:
    """The loader an ELF asks for, or "" when the image is not an ELF.

    Read because a `manylinux` tag is a promise about the C library, and a
    binary built against a different one still packs, still installs and still
    passes a check that only opens the archive. It fails at the moment somebody
    runs it, as `execve` reporting the file as missing - the one error message
    that says nothing about libc.
    """
    if image[:4] != b"\x7fELF" or image[4] != 2:
        return ""
    offset = int.from_bytes(image[0x20:0x28], "little")
    entry_size = int.from_bytes(image[0x36:0x38], "little")
    for index in range(int.from_bytes(image[0x38:0x3A], "little")):
        header = image[offset + index * entry_size : offset + (index + 1) * entry_size]
        if int.from_bytes(header[0:4], "little") != 3:
            continue
        start = int.from_bytes(header[8:16], "little")
        size = int.from_bytes(header[32:40], "little")
        return image[start : start + size].rstrip(b"\x00").decode("utf-8", "replace")
    return ""


def inspect(wheels: pathlib.Path, binaries: pathlib.Path, binary: str, tag: str, name: str) -> str:
    """What is wrong with one wheel, or "" when nothing is."""
    found = list(wheels.glob(f"*-{tag}.whl"))
    if len(found) != 1:
        return f"{tag} matched {len(found)} wheels"

    member = f"keewano_codegen/_bin/{name}"
    with zipfile.ZipFile(found[0]) as archive:
        if member not in archive.namelist():
            return f"{found[0].name} has no {member}"
        image = archive.read(member)

    if digest(image) != digest((binaries / binary).read_bytes()):
        return f"{found[0].name} carries a binary that is not {binary}"

    interpreter = elf_interpreter(image)
    if "manylinux" in tag and "musl" in interpreter:
        return f"{found[0].name} is tagged for glibc but asks for {interpreter}"

    detail = f" needing {interpreter}" if interpreter else ""
    print(f"assert-wheel-binaries: {tag} carries {binary}{detail}")
    return ""


def main() -> int:
    wheels, binaries = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    rest = sys.argv[3:]
    if not rest or len(rest) % 3:
        print("assert-wheel-binaries: expected triples of binary, tag and name", file=sys.stderr)
        return 1

    failed = 0
    for binary, tag, name in zip(rest[0::3], rest[1::3], rest[2::3]):
        wrong = inspect(wheels, binaries, binary, tag, name)
        if wrong:
            print(f"assert-wheel-binaries: {wrong}", file=sys.stderr)
            failed += 1

    if failed:
        print(f"assert-wheel-binaries: {failed} of {len(rest) // 3} wheels are wrong", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
