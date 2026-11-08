#!/usr/bin/env python3
"""impl-explainer: run the format check, then build HTML with MkDocs Material (pinned dependencies).

Usage: python -X utf8 build.py <report_dir>

MkDocs is never installed globally. With uv: `uv run` with the pinned lock (uv's own cache).
Without uv: a venv with the pinned lock is created once, in the user cache dir or, if that is not
writable (e.g. a sandbox), in <repo>/.impl-explainer/ (git-ignored). Only the first run needs internet.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

from _common import LOCK, SKILL_DIR, setup_stdio

ENV = dict(os.environ, NO_MKDOCS_2_WARNING="1", PYTHONIOENCODING="utf-8")


def ok(cmd: list[str], env: dict | None = None) -> bool:
    try:
        return subprocess.run(cmd, capture_output=True, env=env or ENV).returncode == 0
    except OSError:   # e.g. the venv's python was deleted
        return False


def uv_runner(report_dir: Path) -> list[str] | None:
    cmd = ["uv", "run", "--no-project", "--with-requirements", str(LOCK), "mkdocs"]
    print("Preparing pinned MkDocs via uv (the first run may take a minute)...")
    if ok(cmd + ["--version"]):
        return cmd
    # uv's default cache may not be writable (sandbox); retry with a cache inside the git-ignored report root.
    ENV["UV_CACHE_DIR"] = str(report_dir.parent / ".cache" / "uv")
    return cmd if ok(cmd + ["--version"]) else None


def venv_runner(report_dir: Path) -> list[str] | None:
    # Keyed by lock content and Python version, so a lock change or Python upgrade gets a fresh env.
    tag = f"venv-py{sys.version_info[0]}{sys.version_info[1]}-{hashlib.sha256(LOCK.read_bytes()).hexdigest()[:12]}"
    base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / ".cache")
    for d in (base / "impl-explainer" / tag, report_dir.parent / f".{tag}"):
        py = d / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        mkdocs = [str(py), "-m", "mkdocs"]
        if (d / ".ready").exists() and ok(mkdocs + ["--version"]):
            return mkdocs
        try:
            shutil.rmtree(d, ignore_errors=True)   # broken or half-made env
            d.parent.mkdir(parents=True, exist_ok=True)
            print(f"Setting up a pinned MkDocs environment (first run only): {d}")
            if not ok([sys.executable, "-m", "venv", str(d)]):
                raise OSError("venv creation failed")   # treat like an unwritable location: try the next one
        except OSError:
            shutil.rmtree(d, ignore_errors=True)
            continue
        if subprocess.run([str(py), "-m", "pip", "install", "-q", "-r", str(LOCK)], env=ENV).returncode == 0:
            (d / ".ready").write_text("ok", encoding="utf-8")
            return mkdocs
        shutil.rmtree(d, ignore_errors=True)
        return None   # pip failed (usually no internet): another location would fail the same way
    return None


def main() -> int:
    setup_stdio()
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    report_dir = Path(sys.argv[1]).resolve()
    if not (report_dir / "mkdocs.yml").exists():
        sys.exit(f"ERROR: {report_dir / 'mkdocs.yml'} not found.")

    if subprocess.run([sys.executable, "-B", "-X", "utf8", str(SKILL_DIR / "scripts" / "validate.py"), str(report_dir)]).returncode:
        print("\nNot building: the format check has ERRORs. Fix them and rerun.")
        return 1

    mkdocs = (uv_runner(report_dir) if shutil.which("uv") else None) or venv_runner(report_dir)
    if mkdocs is None:
        sys.exit("ERROR: could not prepare MkDocs (needs internet on the first run, and pip or uv). "
                 "Tell the user; installing uv (https://docs.astral.sh/uv/) usually fixes it.")
    r = subprocess.run(mkdocs + ["build", "--strict", "--clean", "-f", str(report_dir / "mkdocs.yml")],
                       cwd=report_dir, env=ENV)
    if r.returncode:
        print("\nERROR: build failed; see the WARNING/ERROR lines above."
              "\n  Common causes: wrong excerpt line range, link to a missing page/anchor, collapsible body not indented.")
        if os.name == "nt" and len(str(report_dir)) > 150:
            print("  The Windows path may be too long (WinError 206): use a shorter repo path or enable LongPathsEnabled.")
        return 1
    print(f"\nBuilt: {(report_dir / 'site' / 'index.html').as_posix()}")
    print("Open the file directly in a browser (no server). Mermaid diagrams need an internet connection.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
