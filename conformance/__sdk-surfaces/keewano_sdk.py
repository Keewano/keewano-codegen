# The Python surface a generated file writes against, written down so the
# vectors can be executed rather than assumed: check-native-vectors.sh imports
# each recorded vector with this module on the path, then calls every wrapper
# it declares. The import runs the module-level from_gzip_base64 call; the
# calls are what resolve the bridge names, which Python looks up only when the
# line inside a wrapper body actually executes.
#
# Mirrors the Python SDK: keewano_sdk/codegen.py (the seven bridge entry
# points) and keewano_sdk/internal/custom_event_set.py (from_gzip_base64),
# both re-exported from keewano_sdk/__init__.py. Checked 2026-08-28 against
# the KMP-2004 branch; npm run check:surfaces compares these declarations
# against that checkout, so a rename upstream fails there rather than
# staying quiet here.
#
# from_gzip_base64 really decodes, so a vector whose payload is not base64 fails
# the import instead of passing as text that merely looks right.
#
# Used by scripts/check-native-vectors.sh; nothing ships from this folder.

import base64


class CustomEventSet:
    def __init__(self, version: int, event_count: int, gzip_data: bytes) -> None:
        self.version = version
        self.event_count = event_count
        self.gzip_data = gzip_data

    @classmethod
    def from_gzip_base64(cls, version: int, event_count: int, gzip_base64: str) -> "CustomEventSet":
        # validate=True because the default silently drops anything outside the base64
        # alphabet: a vector whose payload picked up stray characters decoded clean and
        # the harness stayed green over text no decoder should have accepted. It does not
        # make this a checksum - one alphabet character swapped for another still decodes,
        # and what catches that is the byte comparison against the recording.
        return cls(
            version=version,
            event_count=event_count,
            gzip_data=base64.b64decode(gzip_base64, validate=True),
        )


class KeewanoCodegen:
    @staticmethod
    def report_custom_event(event_id: int) -> None:
        pass

    @staticmethod
    def report_custom_event_int(event_id: int, value: int) -> None:
        pass

    @staticmethod
    def report_custom_event_uint(event_id: int, value: int) -> None:
        pass

    @staticmethod
    def report_custom_event_bool(event_id: int, value: bool) -> None:
        pass

    @staticmethod
    def report_custom_event_float(event_id: int, value: float) -> None:
        pass

    @staticmethod
    def report_custom_event_str(event_id: int, value: str) -> None:
        pass

    @staticmethod
    def report_custom_event_ushort_pair(event_id: int, x: int, y: int) -> None:
        pass
