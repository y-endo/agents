#!/usr/bin/env python3
"""impl-explainer: scaffold a report and write git facts (commits, changed files, diff stats) into it.

Usage:
  python -X utf8 new_report.py --repo <repo_root> --slug <name> (--hypothesis FILE | --no-hypothesis)
                               [--base REF] [--head REF] [--uncommitted]
                               [--editor vscode|cursor|jetbrains|none] [--title TITLE] [--force]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import sys
from pathlib import Path

from _common import EVIDENCE_FILL, EVIDENCE_MACHINE, META_FILE, SKILL_DIR, TEMPLATE_DIR, git as git_raw, setup_stdio

STATUS_JA = {"A": "追加", "M": "変更", "D": "削除", "R": "名前変更", "C": "複製", "T": "種別変更", "?": "未追跡（新規）"}


def git(repo: Path, *args: str, check: bool = True) -> str:
    code, out, err = git_raw(repo, *args)
    if check and code:
        sys.exit(f"ERROR: git {' '.join(args)} failed:\n{err}")
    return out


def ref_exists(repo: Path, ref: str) -> bool:
    return git_raw(repo, "rev-parse", "--verify", "--quiet", ref + "^{commit}")[0] == 0


def default_base(repo: Path, head: str) -> str:
    origin_head = git(repo, "symbolic-ref", "--quiet", "refs/remotes/origin/HEAD", check=False)
    candidates = ([origin_head.replace("refs/remotes/", "")] if origin_head else []) + \
        ["main", "master", "origin/main", "origin/master"]
    head_sha = git(repo, "rev-parse", head)
    for c in candidates:
        if ref_exists(repo, c):
            mb = git(repo, "merge-base", c, head, check=False)
            if mb and mb != head_sha:
                return mb
    if ref_exists(repo, f"{head}~1"):
        return git(repo, "rev-parse", f"{head}~1")
    sys.exit("ERROR: cannot determine the base; pass --base.")


def changed_ranges(repo: Path, diff_args: list[str]) -> dict[str, list[list[int]]]:
    """New-side changed line ranges per file, so validate.py can tell code outside the diff from code inside it.
    Fixed prefixes and no external diff tool, so user git config (mnemonicPrefix, dstPrefix, diff.external)
    cannot change the output."""
    ranges: dict[str, list[list[int]]] = {}
    path = None
    for line in git(repo, "diff", "-U0", "-M", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/",
                    *diff_args, "--").splitlines():
        if line.startswith("+++ "):
            target = line[4:].rstrip("\t")
            path = None if target == "/dev/null" else target[2:] if target.startswith("b/") else target
        elif line.startswith("@@") and path:
            m = re.match(r"@@ -\S+ \+(\d+)(?:,(\d+))? @@", line)
            if m and (count := int(m.group(2) or 1)):
                start = int(m.group(1))
                ranges.setdefault(path, []).append([start, start + count - 1])
    return ranges


def collect(repo: Path, base: str, head: str, uncommitted: bool) -> dict:
    # With --uncommitted, compare the working tree against base (base..HEAD commits + uncommitted changes).
    diff_args = [base] if uncommitted else [f"{base}..{head}"]
    commits = [l.split("\t", 3) for l in
               git(repo, "log", "--reverse", "--format=%h\t%ad\t%an\t%s", "--date=short",
                   f"{base}..{head}", "--").splitlines() if l] if base != head else []
    status = {}
    for line in git(repo, "diff", "--name-status", "-M", *diff_args, "--").splitlines():
        parts = line.split("\t")
        status[parts[-1]] = parts[0][0]
    numstat = {}
    for line in git(repo, "diff", "--numstat", "-M", *diff_args, "--").splitlines():
        add, delete, path = line.split("\t", 2)
        if " => " in path:
            path = re.sub(r"\{(.*?) => (.*?)\}", r"\2", path).split(" => ")[-1]
        numstat[path] = (add, delete)
    ranges = changed_ranges(repo, diff_args)
    if uncommitted:
        for path in git(repo, "ls-files", "--others", "--exclude-standard").splitlines():
            if not path or path.startswith(".impl-explainer/"):
                continue
            status[path] = "?"
            try:
                n = len((repo / path).read_text(encoding="utf-8", errors="replace").splitlines())
                numstat[path] = (str(n), "0")
                ranges[path] = [[1, max(n, 1)]]
            except OSError:
                numstat[path] = ("-", "-")
    files = [{"status": st, "path": p, "add": numstat.get(p, ("-", "-"))[0], "del": numstat.get(p, ("-", "-"))[1]}
             for p, st in sorted(status.items())]
    return {"commits": commits, "files": files, "ranges": ranges}


def evidence_md(meta: dict, data: dict) -> str:
    # Report content stays Japanese.
    def esc(s: str) -> str:
        return s.replace("|", "\\|")

    files = data["files"]
    total_add = sum(int(f["add"]) for f in files if f["add"].isdigit())
    total_del = sum(int(f["del"]) for f in files if f["del"].isdigit())
    target, commits, changed = EVIDENCE_MACHINE
    out = ["# 証拠", "",
           '!!! note "このページの上半分は機械的に出力したもの"',
           f"    「{target}」「{commits}」「{changed}」は new_report.py が git から出力した事実です。書き換えないでください。",
           "", f"## {target}", "",
           "| 項目 | 値 |", "|---|---|",
           f"| リポジトリ | `{meta['repo_root']}` |",
           f"| ブランチ | `{meta['branch']}` |",
           f"| 比較元（base） | `{meta['base']}` |",
           f"| 比較先（head） | `{meta['head']}`" + ("（＋未コミットの変更）" if meta["uncommitted"] else "") + " |",
           f"| 作成日時 | {meta['created_at']} |",
           f"| 作成時の作業ツリー | {'未コミットの変更あり' if meta['dirty'] else 'クリーン'} |",
           "", f"## {commits}", ""]
    if data["commits"]:
        out += ["| ハッシュ | 日付 | 作者 | メッセージ |", "|---|---|---|---|"]
        out += [f"| `{c[0]}` | {c[1]} | {esc(c[2])} | {esc(c[3])} |" for c in data["commits"]]
    else:
        out.append("対象範囲にコミットはありません（未コミットの変更のみ）。")
    out += ["", f"## {changed}", "",
            f"合計 {len(files)} ファイル、追加 {total_add} 行、削除 {total_del} 行。", "",
            "| 状態 | ファイル | 追加 | 削除 |", "|---|---|---:|---:|"]
    out += [f"| {STATUS_JA.get(f['status'], f['status'])} | `{esc(f['path'])}` | {f['add']} | {f['del']} |"
            for f in files]
    for heading, fill in EVIDENCE_FILL.items():
        out += ["", f"## {heading}", "", f"<!-- FILL: {fill} -->"]
    return "\n".join(out) + "\n"


def main() -> None:
    setup_stdio()
    ap = argparse.ArgumentParser(description="Scaffold an impl-explainer report")
    ap.add_argument("--repo", default=".", help="repository root (default: cwd)")
    ap.add_argument("--slug", required=True, help="report name (letters, digits, hyphens)")
    ap.add_argument("--base", help="base ref (default: merge-base with main/master)")
    ap.add_argument("--head", default="HEAD", help="head ref (default: HEAD)")
    ap.add_argument("--uncommitted", action="store_true", help="target the working tree (uncommitted changes)")
    ap.add_argument("--editor", default="vscode", choices=["vscode", "cursor", "jetbrains", "none"],
                    help="editor for [[path:line]] links")
    ap.add_argument("--title", help="report title (default: from slug)")
    ap.add_argument("--force", action="store_true",
                    help="recreate an existing report with the same slug (the old one is kept as <dir>.bak-<time>)")
    hyp = ap.add_mutually_exclusive_group(required=True)
    hyp.add_argument("--hypothesis", help="file with the user's Phase 0 answers, verbatim (validate.py checks the paste)")
    hyp.add_argument("--no-hypothesis", action="store_true", help="only if the user declined to answer Phase 0")
    a = ap.parse_args()

    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]*", a.slug):
        sys.exit("ERROR: --slug may contain only letters, digits and hyphens.")
    if a.uncommitted and a.head != "HEAD":
        sys.exit("ERROR: --uncommitted cannot be combined with --head.")
    hypothesis = None
    if a.hypothesis:
        try:
            hypothesis = Path(a.hypothesis).read_text(encoding="utf-8-sig").strip()   # -sig: drop a BOM
        except (OSError, ValueError) as e:   # ValueError: not UTF-8
            sys.exit(f"ERROR: cannot read the --hypothesis file (save it as UTF-8): {e}")
        if not hypothesis:
            sys.exit("ERROR: the --hypothesis file is empty. Save the user's answers, or --no-hypothesis if they declined.")
    repo = Path(git(Path(a.repo).resolve(), "rev-parse", "--show-toplevel"))
    head = git(repo, "rev-parse", a.head)
    base = git(repo, "rev-parse", a.base) if a.base else (head if a.uncommitted else default_base(repo, a.head))
    dirty_files = set(git(repo, "diff", "--name-only", "HEAD", "--").splitlines())

    root = repo / ".impl-explainer"
    existing = sorted(p for p in root.iterdir() if re.fullmatch(rf"\d{{8}}-{re.escape(a.slug)}", p.name)) \
        if root.exists() else []
    out_dir = existing[-1] if existing else root / f"{dt.date.today():%Y%m%d}-{a.slug}"
    if out_dir.exists() and not a.force:
        sys.exit(f"ERROR: {out_dir} already exists. Use --force to recreate it, or another --slug.")

    data = collect(repo, base, head, a.uncommitted)
    if not data["files"]:
        sys.exit("ERROR: no changes in the target range; check --base / --head / --uncommitted.")
    overlap = sorted(dirty_files & {f["path"] for f in data["files"]})
    if overlap and not a.uncommitted:
        sys.exit("ERROR: target files have uncommitted edits: " + ", ".join(overlap[:5]) +
                 "\n  Excerpts are read from the working tree, so they would not match the target commit."
                 "\n  Do NOT modify the working tree (no checkout/stash/reset). Ask the user; to include the edits, rerun with"
                 f"\n  --uncommitted --base {base[:12]}")

    meta = {
        "repo_root": repo.as_posix(),
        "branch": git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
        "base": base, "head": head, "uncommitted": a.uncommitted, "dirty": bool(dirty_files),
        "created_at": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "skill_dir": SKILL_DIR.as_posix(),
        # Content hashes at the target point; validate.py uses them to detect later changes to cited files.
        "file_hashes": {},
        "changed_ranges": data["ranges"],
        # Phase 0 answers (None = the user declined); validate.py checks they are pasted verbatim.
        "hypothesis": hypothesis,
        # Required headings frozen at scaffold time, so later skill updates do not break this report.
        "required_headings": {
            **{pg.name: [l[3:].strip() for l in pg.read_text(encoding="utf-8").splitlines() if l.startswith("## ")]
               for pg in sorted((TEMPLATE_DIR / "docs").glob("*.md"))},
            "evidence.md": EVIDENCE_MACHINE + list(EVIDENCE_FILL),
        },
    }
    for f in data["files"]:
        if f["status"] == "D":
            continue
        if not a.uncommitted:
            meta["file_hashes"][f["path"]] = git(repo, "rev-parse", f"{head}:{f['path']}")
        elif (repo / f["path"]).is_file():
            meta["file_hashes"][f["path"]] = git(repo, "hash-object", "--", f["path"])

    # Write only after every git call succeeded, so a failure never leaves a half-made directory.
    # --force keeps the old report (pages, brief.md, evidence) instead of deleting it.
    backup = None
    if out_dir.exists():
        backup = out_dir.with_name(f"{out_dir.name}.bak-{dt.datetime.now():%Y%m%d%H%M%S}")
        out_dir.rename(backup)
    root.mkdir(exist_ok=True)
    (root / ".gitignore").write_text("*\n", encoding="utf-8")
    shutil.copytree(TEMPLATE_DIR, out_dir)

    cfg = out_dir / "mkdocs.yml"
    cfg.write_text(cfg.read_text(encoding="utf-8")
                   .replace("{{SITE_NAME}}", (a.title or f"実装解説: {a.slug}").replace('"', "'"))
                   .replace("{{REPO_ROOT}}", repo.as_posix())
                   .replace("{{EDITOR}}", a.editor), encoding="utf-8")
    scope = f"`{base[:8]}`..`{head[:8]}`" + ("＋未コミットの変更" if a.uncommitted else "")
    idx = out_dir / "docs" / "index.md"
    idx.write_text(idx.read_text(encoding="utf-8").replace(
        "{{META_LINE}}", f"対象: `{meta['branch']}` {scope} ／ 作成: {meta['created_at']} ／ 詳細は [証拠](evidence.md)"),
        encoding="utf-8")
    (out_dir / "docs" / "evidence.md").write_text(evidence_md(meta, data), encoding="utf-8")
    (out_dir / META_FILE).write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    total = sum(int(f["add"]) + int(f["del"]) for f in data["files"] if f["add"].isdigit() and f["del"].isdigit())
    print(f"Report scaffolded: {out_dir.as_posix()}")
    if backup:
        print(f"Previous report kept: {backup.as_posix()} (copy back brief.md or pages if still valid; "
              "re-check citations, since line numbers may have moved)")
    print(f"Target: {base[:8]}..{head[:8]}{' + uncommitted' if a.uncommitted else ''}  "
          f"files {len(data['files'])} / changed lines {total}")
    missing = [f["path"] for f in data["files"]
               if f["add"].isdigit() and int(f["add"]) > 0 and f["path"] not in data["ranges"]]
    if missing:
        print("WARNING: could not record changed lines for: " + ", ".join(missing[:5]) +
              ". The 差分の外への影響 check will be lenient for these files; verify their impact items by hand.")
    if dirty_files and not a.uncommitted:
        print("WARNING: uncommitted changes exist in files outside the target; they are not part of the report.")
    if total > 3000 or len(data["files"]) > 40:
        print("WARNING: large diff. Ask the user which areas matter most, then narrow or split.")
    if not a.uncommitted and head != git(repo, "rev-parse", "HEAD"):
        print("WARNING: --head differs from the current HEAD. Excerpts are read from the working tree; "
              "ask the user to check out the target head before writing and building.")


if __name__ == "__main__":
    main()
