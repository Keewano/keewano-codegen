"""Keewano custom-events codegen, delivered as a Python package.

The generator itself is not Python: it is a single executable carrying its own
runtime, built once and packed into a wheel per platform. This package is the
handle - it finds the executable that shipped beside it and runs it, so a Python
project installs the tool the way it installs anything else and never learns that
a binary is involved.
"""

__all__ = ["main"]

from .cli import main
