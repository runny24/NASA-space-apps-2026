"""Where the pipeline reads and writes, and the optional .env file.

Every path is built with pathlib from the repository root, so the same code works on Windows, macOS
and Linux. Tests pass their own Layout pointing into a temporary folder, so they never touch the real
work/ or web/public/data/ folders.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Layout:
    """The three folders a pipeline run touches."""

    sites_dir: Path  # inputs: <id>.yaml and <id>.granules.json
    work_dir: Path  # git-ignored scratch: windows, processed rasters, QA plots
    data_dir: Path  # web-ready outputs: the folder that holds manifest.json

    def site_work(self, site_id: str) -> Path:
        return self.work_dir / site_id

    def site_data(self, site_id: str) -> Path:
        return self.data_dir / site_id


def default_layout() -> Layout:
    return Layout(
        sites_dir=REPO_ROOT / "pipeline" / "sites",
        work_dir=REPO_ROOT / "work",
        data_dir=REPO_ROOT / "web" / "public" / "data",
    )


def contract_dir() -> Path:
    return REPO_ROOT / "contract"


def load_env_file(path: Path | None = None) -> list[str]:
    """Load KEY=value lines from the repository's .env file into os.environ.

    Windows users can then keep EARTHDATA_TOKEN and similar settings in one git-ignored file instead
    of setting environment variables by hand. Variables already set in the environment win, so a
    one-off override on the command line still works. Returns the names that were loaded (never the
    values, which may be credentials).
    """
    path = path or REPO_ROOT / ".env"
    if not path.is_file():
        return []
    loaded = []
    for raw in path.read_text(encoding="utf-8-sig").splitlines():  # utf-8-sig: Notepad may add a BOM
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        # An empty value (as in .env.example) means "not set", so it must not hide a real setting.
        if key and value and key not in os.environ:
            os.environ[key] = value
            loaded.append(key)
    return loaded
