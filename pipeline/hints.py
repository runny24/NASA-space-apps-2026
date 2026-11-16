"""How to tell a person which command to run next.

Every message that names a command uses `command()`, so the hint is always the form that works on every
teammate's machine. A bare `python -m pipeline ...` would use whatever Python is first on the PATH, which
on a Windows PC is usually not the project's virtual environment and lacks the pinned packages. The
`npm run pipeline --` form finds the virtual environment by itself.
"""

from __future__ import annotations

# PowerShell can swallow the `--` separator; this form works in every shell. Mention it once per message
# that gives a command, not after every command.
POWERSHELL_NOTE = "(in PowerShell, if the arguments go missing: node scripts/py.mjs -m pipeline ...)"


def command(*args: str) -> str:
    """The command line a teammate should type, e.g. command("auth-check") or
    command("discover", "--site", "my-site")."""
    return " ".join(["npm run pipeline --", *args])
