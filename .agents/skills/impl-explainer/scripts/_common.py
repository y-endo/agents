"""Shared constants and helpers for the impl-explainer scripts."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = SKILL_DIR / "assets" / "template"
LOCK = SKILL_DIR / "assets" / "requirements.lock"
META_FILE = "impl-explainer-meta.json"
PAGES = ["index.md", "flow.md", "design.md", "code.md", "review.md",
         "operations.md", "faq.md", "quiz.md", "evidence.md"]
# evidence.md: headings written mechanically by new_report.py, then the ones the agent fills (with FILL hints).
EVIDENCE_MACHINE = ["対象", "コミット", "変更ファイル"]
EVIDENCE_FILL = {
    "実行した確認": "Per check: ### <what> → command / cwd / exit code / output (verbatim excerpt) / what it shows / "
              "what it does not. Checks not run: 未実行 + reason.",
    "読んだ範囲と読んでいない範囲": "Files read; related areas not read.",
    "別コンテキスト検証": "実施 / 未実施（理由） / 未実施（自己チェックのみ）; adopted fixes; rejected findings with one-line reasons.",
    "作業体制": "Orchestrator / worker / verifier models; number of review rounds.",
}


def setup_stdio() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def git(repo: Path, *args: str) -> tuple[int, str, str]:
    """Run git with paths printed verbatim (no octal escaping of non-ASCII names)."""
    r = subprocess.run(["git", "-c", "core.quotePath=false", "-C", str(repo), *args],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, r.stdout.strip(), r.stderr.strip()


def norm_path(rel: str) -> str:
    rel = rel.strip().replace("\\", "/")
    while rel.startswith("./"):
        rel = rel[2:]
    return rel


def load_meta(report_dir: Path) -> dict | None:
    p = report_dir / META_FILE
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
