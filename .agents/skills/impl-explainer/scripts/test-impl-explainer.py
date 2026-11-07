#!/usr/bin/env python3
"""impl-explainer の回帰テスト（スクリプトを変更したときに実行する）。

使い方:
  python -X utf8 scripts/test-impl-explainer.py [--sample <完成済みレポートのディレクトリ>] [--no-build] [--env]

- git の特殊ケース（空白・日本語のパス、削除、未追跡、ユーザーの git 設定）で new_report.py を検査
- --sample を渡すと、そのレポートの複製を少しずつ壊して validate.py の各検査が働くかを確認し、
  最後に build.py でビルドまで通す
- --env を付けると、uv がない環境での MkDocs 環境の自動準備（初回はネット接続が必要）も確認する
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
FAILS: list[str] = []


def run(*cmd: str, cwd: Path | None = None, env: dict | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(list(cmd), cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("OK   " if ok else "FAIL ") + name + ("" if ok else f"\n     {detail}"))
    if not ok:
        FAILS.append(name)


def git(repo: Path, *args: str) -> None:
    r = run("git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.autocrlf=false", *args, cwd=repo)
    assert r.returncode == 0, r.stderr


def script(name: str, *args: str, cwd: Path | None = None, env: dict | None = None) -> subprocess.CompletedProcess:
    # -B: スキルのディレクトリに __pycache__ を残さない（.claude/skills への同期対象になるため）
    return run(sys.executable, "-B", "-X", "utf8", str(SCRIPTS / name), *args, cwd=cwd, env=env)


def meta_of(repo: Path, slug: str) -> dict:
    d = next(p for p in (repo / ".impl-explainer").iterdir() if p.name.endswith("-" + slug))
    return json.loads((d / "impl-explainer-meta.json").read_text(encoding="utf-8"))


def git_cases(tmp: Path) -> None:
    repo = tmp / "repo"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    (repo / "sp ace.py").write_text("a\nb\nc\n", encoding="utf-8")
    (repo / "gone.cfg").write_text("x\n", encoding="utf-8")
    (repo / "keep.py").write_text("k\nl\n", encoding="utf-8")
    (repo / "日本語.py").write_text("あ\nい\n", encoding="utf-8")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "base")
    git(repo, "checkout", "-qb", "feat")
    (repo / "sp ace.py").write_text("a\nB\nc\n", encoding="utf-8")
    (repo / "日本語.py").write_text("あ\nイ\n", encoding="utf-8")
    git(repo, "rm", "-q", "gone.cfg")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "feat")
    # ユーザー側の git 設定で出力が変わらないこと
    git(repo, "config", "diff.mnemonicPrefix", "true")
    git(repo, "config", "diff.external", "false")

    r = script("new_report.py", "--slug", "c0", cwd=repo)
    check("hypothesis choice is required", r.returncode != 0 and "--hypothesis" in r.stderr, r.stdout + r.stderr)

    r = script("new_report.py", "--no-hypothesis", "--slug", "c1", cwd=repo)
    check("committed: scaffold", r.returncode == 0, r.stdout + r.stderr)
    if r.returncode == 0:
        ranges = meta_of(repo, "c1")["changed_ranges"]
        check("committed: changed ranges", ranges == {"sp ace.py": [[2, 2]], "日本語.py": [[2, 2]]}, str(ranges))
        check("committed: no missing-lines warning", "could not record" not in r.stdout, r.stdout)

    r = script("new_report.py", "--no-hypothesis", "--slug", "c1", "--force", cwd=repo)
    check("--force keeps the old report", r.returncode == 0 and any((repo / ".impl-explainer").glob("*-c1.bak-*")),
          r.stdout + r.stderr)

    (repo / "keep.py").write_text("k\nL\n", encoding="utf-8")
    r = script("new_report.py", "--no-hypothesis", "--slug", "c2", cwd=repo)
    check("dirty non-target file only warns", r.returncode == 0 and "outside the target" in r.stdout, r.stdout + r.stderr)

    (repo / "sp ace.py").write_text("a\nB\nC\n", encoding="utf-8")
    r = script("new_report.py", "--no-hypothesis", "--slug", "c2b", cwd=repo)
    check("dirty target file stops", r.returncode != 0 and "--uncommitted" in r.stderr, r.stdout + r.stderr)

    (repo / "new.py").write_text("n1\nn2\nn3\n", encoding="utf-8")
    r = script("new_report.py", "--no-hypothesis", "--slug", "c3", "--uncommitted", "--base", "main", cwd=repo)
    check("uncommitted: scaffold", r.returncode == 0, r.stdout + r.stderr)
    if r.returncode == 0:
        ranges = meta_of(repo, "c3")["changed_ranges"]
        check("uncommitted: ranges incl. untracked",
              ranges.get("keep.py") == [[2, 2]] and ranges.get("sp ace.py") == [[2, 3]]
              and ranges.get("new.py") == [[1, 3]] and "gone.cfg" not in ranges, str(ranges))

    (repo / ".impl-explainer" / "20000101-payment-api").mkdir()
    r = script("new_report.py", "--no-hypothesis", "--slug", "api", "--uncommitted", cwd=repo)
    check("slug is matched exactly", r.returncode == 0 and (repo / ".impl-explainer" / "20000101-payment-api").exists(),
          r.stdout + r.stderr)


def validate(report: Path) -> str:
    return script("validate.py", str(report)).stdout


def mutate(report: Path, page: str, fn) -> None:
    p = report / "docs" / page
    p.write_text(fn(p.read_text(encoding="utf-8")), encoding="utf-8")


def section_sub(heading: str, body: str):
    return lambda s: re.sub(rf"(## {re.escape(heading)}\n).*?(?=\n## |\Z)", lambda m: m.group(1) + "\n" + body + "\n", s,
                            count=1, flags=re.S)


def validate_cases(sample: Path, tmp: Path, build: bool) -> None:
    def fresh(name: str) -> Path:
        d = tmp / name
        shutil.copytree(sample, d, ignore=shutil.ignore_patterns("site"))
        return d

    base = fresh("base")
    out = validate(base)
    check("sample passes", "ERROR 0" in out, out)
    changed = meta_of_report(base)["changed_ranges"]
    cpath, (cstart, _) = next((p, r[0]) for p, r in changed.items() if r)

    cases = [
        ("FILL left", "flow.md", lambda s: s + "\n<!-- FILL: x -->\n", "unfilled"),
        ("citation out of range", "flow.md", lambda s: s + f"\n[[{cpath}:99999]]\n", "out of range"),
        ("invalid verdict", "index.md", lambda s: s.replace("| 相違 |", "| たぶん |", 1), "not allowed"),
        ("diagram without caption", "flow.md",
         lambda s: s + '\n```mermaid\nflowchart TD\n  a["x"] --> b["y"]\n```\n\n本文\n', "is not followed by"),
        ("unquoted Mermaid label", "flow.md",
         lambda s: s + '\n```mermaid\nflowchart TD\n  a[x] --> b["y"]\n```\n\n**この図で分かること:** x\n', "quote the label"),
        ("hand-written code", "code.md", lambda s: s + '\n```python\nprint("x")\n```\n', "hand-written code"),
        ("impact cites only changed lines", "review.md", section_sub("差分の外への影響",
         f"**探し方:** grep\n\n### 影響: x\n- 変更箇所: [[{cpath}:{cstart}]]\n- 意味が変わる既存コード: [[{cpath}:{cstart}]]\n"
         "- 何が変わるか: x【推測】\n"), "cites only changed lines"),
        ("impact 該当なし without search", "review.md", section_sub("差分の外への影響", "該当なし"), "must state how you searched"),
        ("required section hidden in a comment", "review.md",
         lambda s: s.replace("## 差分の外への影響", "<!--\n## 差分の外への影響").replace("## 過剰実装の疑い", "-->\n## 過剰実装の疑い"),
         "'## 差分の外への影響' is missing"),
        ("section with only hidden text", "operations.md",
         section_sub("監視・ログ", "<!-- 監視はある -->"), "'## 監視・ログ' is empty"),
    ]
    for name, page, fn, expect in cases:
        d = fresh(name.replace(" ", "_"))
        mutate(d, page, fn)
        out = validate(d)
        check(f"detects: {name}", expect in out, out[-400:])

    # Phase 0 answers recorded by new_report.py --hypothesis / --no-hypothesis
    raw = re.search(r"\?\?\? quote.*\n\s+(\S.*)", (base / "docs" / "index.md").read_text(encoding="utf-8")).group(1)
    for name, answers, expect in [("hypothesis not pasted verbatim", "未記載の回答", "does not contain the Phase 0 answers"),
                                  ("declined hypothesis but a table", None, "declined Phase 0"),
                                  ("hypothesis only in an HTML comment", raw, "does not contain the Phase 0 answers"),
                                  ("hypothesis section wrapped in a comment", raw, "does not contain the Phase 0 answers"),
                                  ("hypothesis pasted verbatim", raw, None),
                                  ("hypothesis with words joined", "入力 `a b` は拒否", "does not contain the Phase 0 answers"),
                                  ("hypothesis with words appended", "認証は必要", "does not contain the Phase 0 answers"),
                                  ("hypothesis with a comment in multi-line inline code", "回答 `a\n<!-- debug -->` です", None),
                                  ("hypothesis with a comment in an indented code block", "回答:\n\n    <!-- debug -->", None),
                                  ("hypothesis with a bare comment", "回答 <!-- メモ --> です", None),
                                  ("hypothesis with an HTML comment in inline code", "回答 `<!-- debug -->` です", None)]:
        d = fresh(name.replace(" ", "_"))
        set_meta(d, hypothesis=answers)
        if "only in" in name:   # the answers exist only where readers cannot see them
            mutate(d, "index.md", lambda s: s.replace(raw, "x") + f"\n<!-- {raw} -->\n")
        elif "wrapped" in name:
            mutate(d, "index.md", lambda s: s.replace("## 事前仮説（原文）", "<!--\n## 事前仮説（原文）") + "\n-->\n")
        elif "joined" in name:   # a space inside a line was removed: not an indentation change
            mutate(d, "index.md", lambda s: s + "\n    入力 `ab` は拒否\n")
        elif "appended" in name:   # meaning reversed by words added to the end of a line
            mutate(d, "index.md", lambda s: s + "\n    認証は必要ない\n")
        elif answers and "<!--" in answers:   # the answer itself contains an HTML comment: paste it verbatim, indented
            mutate(d, "index.md", lambda s: s + "\n" + "".join(f"    {l}\n" for l in answers.splitlines()))
        out = validate(d)
        check(f"{'accepts' if expect is None else 'detects'}: {name}", "ERROR 0" in out if expect is None else expect in out,
              out[-400:])

    ok_cases = [
        ("commands may be hand-written", "code.md", lambda s: s + "\n```bash\nuv run pytest\n```\n"),
        ("code fence inside the verbatim answers", "index.md",
         lambda s: s + "\n    ```\n    agent instructions with a fence\n    ```\n"),
        ("unclosed HTML comment inside fenced output", "evidence.md",
         lambda s: s.replace("## 読んだ範囲と読んでいない範囲", "```text\n<div><!-- grep hit\n```\n\n## 読んだ範囲と読んでいない範囲", 1)
                    + "\n```text\nend -->\n```\n"),
        ("decorated skip declaration", "index.md", section_sub("仮説との照合", "**仮説なしで作成（照合なし）**")),
        ("仮説なしで作成 quoted in a table cell", "index.md",
         lambda s: s.replace("| 相違 |", "（「仮説なしで作成」とは別） | 相違 |", 1)),
        ("impact 該当なし with search", "review.md", section_sub("差分の外への影響", "該当なし（探し方: grep で検索）")),
        ("design decisions 該当なし", "design.md", section_sub("設計判断", "該当なし（文言修正のみ）")),
    ]
    for name, page, fn in ok_cases:
        d = fresh(name.replace(" ", "_"))
        mutate(d, page, fn)
        out = validate(d)
        check(f"accepts: {name}", "ERROR 0" in out, out[-400:])

    if build:
        r = script("build.py", str(base))
        check("build succeeds", r.returncode == 0 and (base / "site" / "index.html").exists(), (r.stdout + r.stderr)[-600:])


def env_cases(sample: Path, tmp: Path) -> None:
    """build.py without uv: venv in the user cache, reuse, and the repo-local fallback (needs internet once)."""
    report = tmp / "env" / "report"
    shutil.copytree(sample, report, ignore=shutil.ignore_patterns("site"))
    no_uv_path = os.pathsep.join(p for p in os.environ["PATH"].split(os.pathsep)
                                 if not (Path(p) / ("uv.exe" if os.name == "nt" else "uv")).exists())
    cache = tmp / "env" / "cache"
    cache.mkdir()
    env = dict(os.environ, PATH=no_uv_path, LOCALAPPDATA=str(cache), HOME=str(cache))
    r = script("build.py", str(report), env=env)
    check("no uv: venv in user cache", r.returncode == 0 and any((cache / "impl-explainer").glob("venv-*/.ready")),
          (r.stdout + r.stderr)[-600:])
    r = script("build.py", str(report), env=env)
    check("no uv: env is reused", r.returncode == 0 and "Setting up" not in r.stdout, r.stdout[-400:])
    blocked = tmp / "env" / "not-a-dir"
    blocked.write_text("x")
    r = script("build.py", str(report), env=dict(env, LOCALAPPDATA=str(blocked), HOME=str(blocked)))
    check("no uv: falls back to the report root", r.returncode == 0 and any(report.parent.glob(".venv-*/.ready")),
          (r.stdout + r.stderr)[-600:])


def meta_of_report(report: Path) -> dict:
    return json.loads((report / "impl-explainer-meta.json").read_text(encoding="utf-8"))


def set_meta(report: Path, **kv) -> None:
    meta = meta_of_report(report)
    meta.update(kv)
    (report / "impl-explainer-meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", help="a finished report directory (validate/build cases)")
    ap.add_argument("--no-build", action="store_true")
    ap.add_argument("--env", action="store_true", help="also test build.py without uv (slow, needs internet)")
    a = ap.parse_args()
    with tempfile.TemporaryDirectory(prefix="iex-") as t:
        tmp = Path(t)
        git_cases(tmp)
        if a.sample:
            validate_cases(Path(a.sample).resolve(), tmp, not a.no_build)
            if a.env:
                env_cases(Path(a.sample).resolve(), tmp)
    print(f"\n{'ALL PASSED' if not FAILS else str(len(FAILS)) + ' FAILED'}")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
