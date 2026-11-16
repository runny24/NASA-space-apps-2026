"""Command line: `npm run pipeline -- <command>` from the repository root, which runs `python -m pipeline
<command>` with the project's virtual environment (a bare `python` may be another interpreter).

Commands come from several modules. Each module in COMMAND_MODULES has a register(subparsers) function
that adds its subcommands and sets `func` to a handler returning an exit code. A module that fails to
import is skipped with a warning, so the rest of the pipeline stays usable while one part is broken or
unfinished (and so that two people can work on different modules at once).
"""

from __future__ import annotations

import argparse
import importlib
import os
import sys

from pipeline import __version__
from pipeline.paths import load_env_file

COMMAND_MODULES = (
    "pipeline.discover",  # coverage, discover  (catalog search)
    "pipeline.auth",  # auth-check
    "pipeline.stages",  # fetch, process, analyse, fires, marker, qa, export, manifest, validate, inspect, run
)


def build_parser(modules: tuple[str, ...] = COMMAND_MODULES) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="npm run pipeline --",
        description="Turn NISAR products into web-ready rasters and the data manifest. "
                    "Run from the repository root.")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    subparsers = parser.add_subparsers(dest="command", metavar="<command>")
    for name in modules:
        try:
            module = importlib.import_module(name)
            module.register(subparsers)
        except Exception as exc:  # any failure here must not take the other commands down
            print(f"warning: commands from {name} are unavailable ({type(exc).__name__}: {exc})",
                  file=sys.stderr)
    return parser


def main(argv: list[str] | None = None) -> int:
    load_env_file()  # credentials from .env (never printed)
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        return 2
    try:
        return int(args.func(args) or 0)
    except KeyboardInterrupt:
        print("interrupted", file=sys.stderr)
        return 130
    except Exception as exc:
        # One readable line for expected problems (bad config, no login, grid mismatch); set
        # PIPELINE_DEBUG=1 to see the full traceback.
        if os.environ.get("PIPELINE_DEBUG"):
            raise
        print(f"error: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
