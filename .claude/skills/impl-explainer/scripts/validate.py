#!/usr/bin/env python3
"""impl-explainer: format check of a report.

Does NOT guarantee correctness. Checks only what is mechanical: cited files/lines exist, required
sections are filled, diagrams are likely to render, code did not change after the report's target point.

Usage: python3 -B -X utf8 validate.py <report_dir>     Exit code 1 if any ERROR.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from _common import EVIDENCE_FILL, EVIDENCE_MACHINE, PAGES, TEMPLATE_DIR, git, load_meta, norm_path, setup_stdio

FENCE_RE = re.compile(r"^(\s*)(`{3,}|~{3,})\s*([\w-]*)")
INLINE_CODE_RE = re.compile(r"(`+)(.+?)\1")
# Fenced block | inline code | HTML comment, matched left to right (whichever starts first wins).
COMMENT_OR_CODE_RE = re.compile(r"^[ \t]*(`{3,}|~{3,}).*?^[ \t]*\1[`~]*[ \t]*$"   # fenced block
                                r"|(`+)(?:[^\n]|\n(?![ \t]*\n))+?\2"              # inline code (no blank line)
                                r"|<!--.*?-->", re.M | re.S)
SRC_RE = re.compile(r"\[\[([^\[\]:]+?):(\d+)(?:-(\d+))?\]\]")
SNIPPET_RE = re.compile(r'--8<--\s+"([^"]+)"')
BADGE_RE = re.compile(r"【(確認済み|推測|未確認)】")
CAPTION_RE = re.compile(r"^\*\*この図で分かること[:：]\*\*")
VERDICTS = {"一致", "部分一致", "相違", "判断不可"}
SLOP = ["シームレス", "堅牢", "包括的", "革新的", "エレガント", "強力な", "画期的", "最先端",
        "ベストプラクティスに従", "様々な", "柔軟性の高い", "スケーラブルな"]
EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF☀-➿⭐✅❌]")
MERMAID_SKIP = re.compile(r"^\s*(classDef|class|style|linkStyle|click|subgraph|end\b|direction|%%|flowchart|graph)")
NODE_DEF_RE = re.compile(r"([A-Za-z_]\w*)(?:\(\[|\[\[|\[\(|\(\(|\{\{|\[|\(|\{)")
LABEL_HINT = "【確認済み】【推測】【未確認】"
# Languages that may be hand-written (commands, output, plain text). Everything else must come from snippets.
FREE_LANGS = {"text", "console", "shell", "bash", "sh", "powershell", "output"}
MAX_SNIPPET_LINES = 30
MAX_BODY_CHARS = 20000


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, page: str, msg: str) -> None:
        self.errors.append(f"[{page}] {msg}")

    def warn(self, page: str, msg: str) -> None:
        self.warnings.append(f"[{page}] {msg}")


# ---------------------------------------------------------------- Markdown helpers

def split_blocks(text: str):
    """Yield (line_no, line, kind): kind is None for body text, else (open|fence|close, lang)."""
    fence, lang = None, ""
    for no, line in enumerate(text.split("\n"), 1):
        m = FENCE_RE.match(line)
        if fence is None and m:
            fence, lang = m.group(2), m.group(3)
            yield no, line, ("open", lang)
        elif fence is not None:
            s = line.strip()
            if s and s[0] == fence[0] and s == s[0] * len(s) and len(s) >= len(fence):
                yield no, line, ("close", lang)
                fence = None
            else:
                yield no, line, ("fence", lang)
        else:
            yield no, line, None


def strip_inline_code(line: str) -> str:
    return INLINE_CODE_RE.sub("", line)


def visible_text(text: str) -> str:
    """Remove HTML comments (invisible to readers), but not `<!--` inside code blocks or inline code."""
    return COMMENT_OR_CODE_RE.sub(lambda m: "" if m.group(0).startswith("<!--") else m.group(0), text)


def contains_lines(text: str, part: str) -> bool:
    """True if part's lines appear in text as consecutive whole lines (only indentation and blank lines may differ)."""
    def lines(s: str) -> list[str]:
        return [l.strip() for l in s.splitlines() if l.strip()]
    t, p = lines(text), lines(part)
    return any(t[i:i + len(p)] == p for i in range(len(t) - len(p) + 1))


def sections(text: str) -> dict[str, str]:
    out, cur, buf = {}, None, []
    for _, line, kind in split_blocks(text):
        if kind is None and line.startswith("## "):
            if cur is not None:
                out[cur] = "\n".join(buf)
            cur, buf = line[3:].strip(), []
        elif cur is not None:
            buf.append(line)
    if cur is not None:
        out[cur] = "\n".join(buf)
    return out


def h3_blocks(section_text: str, prefix: str = "") -> list[str]:
    """`### ` blocks of a section whose title starts with prefix."""
    blocks, cur = [], None
    for line in section_text.split("\n"):
        if line.startswith("### "):
            if cur is not None:
                blocks.append(cur)
            cur = line + "\n" if line[4:].startswith(prefix) else None
        elif cur is not None:
            cur += line + "\n"
    if cur is not None:
        blocks.append(cur)
    return blocks


def title(block: str) -> str:
    return block.splitlines()[0][4:]


def refs(text: str) -> list[tuple[str, int, int | None]]:
    return [(m.group(1), int(m.group(2)), int(m.group(3)) if m.group(3) else None)
            for m in SRC_RE.finditer(strip_inline_code(text))]


def required_headings(page: str, meta: dict) -> list[str]:
    # Frozen in meta at scaffold time, so later skill updates do not break existing reports.
    if page in meta.get("required_headings", {}):
        return meta["required_headings"][page]
    if page == "evidence.md":
        return EVIDENCE_MACHINE + list(EVIDENCE_FILL)[:3]
    t = TEMPLATE_DIR / "docs" / page
    return [l[3:].strip() for l in t.read_text(encoding="utf-8").splitlines() if l.startswith("## ")]


# ---------------------------------------------------------------- repository checks

class Repo:
    def __init__(self, meta: dict) -> None:
        self.root = Path(meta["repo_root"])
        self.meta = meta
        self.lines: dict[str, int | None] = {}
        self.drift_checked: set[str] = set()

    def line_count(self, rel: str) -> int | None:
        if rel not in self.lines:
            p = (self.root / rel).resolve()
            inside = p.is_relative_to(self.root.resolve())
            self.lines[rel] = len(p.read_bytes().decode("utf-8", "replace").splitlines()) \
                if inside and p.is_file() else None
        return self.lines[rel]

    def check_drift(self, rel: str, page: str, rep: Report) -> None:
        """Has the cited file changed since the report's target point (head, or the uncommitted state)?"""
        if rel in self.drift_checked:
            return
        self.drift_checked.add(rel)
        code, now, _ = git(self.root, "hash-object", "--", rel)
        if code:
            return
        expected = self.meta.get("file_hashes", {}).get(rel)
        if expected is None:
            code, expected, _ = git(self.root, "rev-parse", f"{self.meta['head']}:{rel}")
            if code:
                return
        if now != expected:
            rep.err(page, f"{rel} changed since the report's target point (excerpts and line numbers would be off). "
                          "Do NOT modify the working tree (no checkout/stash/reset); ask the user, then rebuild "
                          "the report against the current state.")

    def check_ref(self, rel: str, start: int, end: int | None, page: str, rep: Report, what: str) -> None:
        rel = norm_path(rel)
        n = self.line_count(rel)
        if n is None:
            rep.err(page, f"{what} {rel}: file not found in the repository.")
            return
        last = end or start
        if start < 1 or last < start or last > n:
            rep.err(page, f"{what} {rel}:{start}{'-' + str(end) if end else ''} is out of range (file has {n} lines).")
            return
        self.check_drift(rel, page, rep)

    def outside_changed(self, rel: str, start: int, end: int | None) -> bool:
        """True if the cited range has at least one line outside the diff's changed lines."""
        ranges = self.meta.get("changed_ranges", {}).get(norm_path(rel), [])
        changed = {n for a, b in ranges for n in range(a, b + 1)}
        return any(n not in changed for n in range(start, (end or start) + 1))


# ---------------------------------------------------------------- common page checks

def check_mermaid(block: list[str], page: str, start_no: int, rep: Report) -> str:
    body = [l for l in block if l.strip()]
    if not body:
        rep.err(page, f"line {start_no}: empty Mermaid block.")
        return ""
    kind = body[0].strip().split()[0]
    if kind in ("flowchart", "graph"):
        ids = set()
        for i, line in enumerate(block, start_no + 1):
            if MERMAID_SKIP.match(line):
                continue
            if line.count('"') % 2:
                rep.err(page, f"line {i}: unbalanced double quotes (no \" inside labels; use 「」).")
                continue
            bare = re.sub(r'"[^"]*"', '""', re.sub(r"\|[^|]*\|", "||", line))
            for m in NODE_DEF_RE.finditer(bare):
                if bare[m.end():m.end() + 1] != '"':
                    rep.err(page, f"line {i}: quote the label of node `{m.group(1)}` (e.g. {m.group(1)}[\"ラベル\"]).")
                if m.group(1) == "end":
                    rep.err(page, f"line {i}: `end` as a node ID breaks the diagram.")
                ids.add(m.group(1))
            if re.search(r"[#;]", re.sub(r'"[^"]*"', "", re.sub(r"\|[^|]*\|", "", line))):
                rep.warn(page, f"line {i}: `#` or `;` may break the diagram.")
        if len(ids) > 12:
            rep.warn(page, f"diagram at line {start_no}: {len(ids)} nodes; split or merge to <= 12.")
    elif kind == "sequenceDiagram":
        parts = [l for l in block if re.match(r"^\s*(participant|actor)\s", l)]
        if len(parts) > 6:
            rep.warn(page, f"diagram at line {start_no}: {len(parts)} participants; keep <= 6.")
        for i, line in enumerate(block, start_no + 1):
            if ":" in line and re.search(r"[#;]", line.split(":", 1)[1]):
                rep.err(page, f"line {i}: `#` or `;` in a sequence message breaks the diagram.")
    return kind


def check_snippet(spec: str, no: int, page: str, repo: Repo, rep: Report) -> None:
    rel, *nums = spec.split(":")
    nums = [int(x) for x in nums[:2] if x.isdigit()]
    if not nums:
        repo.check_ref(rel, 1, None, page, rep, "excerpt")
        rep.warn(page, f"line {no}: excerpt without line range (pulls the whole file).")
        return
    s, e = nums[0], nums[-1]
    repo.check_ref(rel, s, e, page, rep, "excerpt")
    if e - s + 1 > MAX_SNIPPET_LINES:
        rep.warn(page, f"line {no}: excerpt has {e - s + 1} lines; keep <= {MAX_SNIPPET_LINES}.")


def check_page(page: str, text: str, repo: Repo, rep: Report) -> list[str]:
    """Checks that apply to every page. Returns the Mermaid diagram kinds found."""
    if "<!-- FILL" in text or "{{META_LINE}}" in text:
        rep.err(page, "unfilled <!-- FILL ... --> remains.")
    kinds: list[str] = []
    mermaid, code, caption_due = None, None, None   # open Mermaid block, open code block, diagram awaiting caption
    heading = ""
    for no, line, kind in split_blocks(text):
        state = kind[0] if kind else None
        if state is None and line.startswith("## "):
            heading = line[3:].strip()
        if state == "open":
            if kind[1] == "mermaid":
                mermaid = (no, [])
            else:
                code = {"line": no, "lang": kind[1], "snippet": False}
        elif state == "close":
            # evidence.md and the verbatim Phase 0 answers may contain any text.
            if code and not code["snippet"] and code["lang"] not in FREE_LANGS and page != "evidence.md" \
                    and heading != "事前仮説（原文）":
                rep.err(page, f"line {code['line']}: hand-written code block. Pull code with snippets (--8<--); "
                              f"only commands/output may be hand-written, as {' / '.join(sorted(FREE_LANGS))}.")
            if mermaid:
                kinds.append(check_mermaid(mermaid[1], page, mermaid[0], rep))
                caption_due = mermaid[0]
            mermaid, code = None, None
        elif state == "fence":
            if mermaid:
                mermaid[1].append(line)
            for m in SNIPPET_RE.finditer(line):
                if code:
                    code["snippet"] = True
                check_snippet(m.group(1), no, page, repo, rep)
        else:
            if caption_due and line.strip():
                if not CAPTION_RE.match(line.strip()):
                    rep.err(page, f"diagram at line {caption_due} is not followed by '**この図で分かること:** ...'.")
                caption_due = None
            body = strip_inline_code(line)
            for r in refs(line):
                repo.check_ref(*r, page, rep, "reference")
            for w in SLOP:
                if w in body:
                    rep.warn(page, f"line {no}: hype word '{w}'; be specific.")
            if EMOJI_RE.search(body):
                rep.warn(page, f"line {no}: no emoji.")
    if caption_due:
        rep.err(page, f"diagram at line {caption_due} is not followed by '**この図で分かること:** ...'.")
    return kinds


# ---------------------------------------------------------------- page-specific checks

def need_diagram(secs, kinds, heading, wanted, what, page, rep) -> None:
    """wanted=None accepts any diagram type."""
    if not any(wanted is None or k in wanted for k in kinds) and not secs.get(heading, "").strip().startswith("該当なし"):
        rep.err(page, f"'{heading}' has no {what} (if not applicable, write 該当なし + reason).")


def check_index(page, secs, kinds, repo, rep) -> None:
    need_diagram(secs, kinds, "全体図", None, "Mermaid diagram", page, rep)
    hyp, raw = secs.get("仮説との照合", ""), secs.get("事前仮説（原文）", "")   # visible text only (see validate)
    # The skip declaration replaces the whole table, so it is on the first line (a mention in a table cell is not one).
    skipped = "仮説なしで作成" in (hyp.strip().splitlines() or [""])[0]
    if "hypothesis" in repo.meta:   # recorded at scaffold time (reports made before this have no key)
        answers = repo.meta["hypothesis"]
        if answers is None and not skipped:
            rep.err(page, "the user declined Phase 0 (--no-hypothesis); write 仮説なしで作成（照合なし） in '仮説との照合'.")
        if answers is not None:
            if skipped:
                rep.err(page, "Phase 0 answers exist; '仮説との照合' needs the verdict table, not 仮説なしで作成.")
            # Strip comments from the answers too, so both sides are transformed the same way.
            if not contains_lines(raw, visible_text(answers)):
                rep.err(page, "'事前仮説（原文）' does not contain the Phase 0 answers verbatim (--hypothesis file); "
                              "paste them unchanged (only indentation and blank lines may differ).")
    if not skipped:
        rows = [r for r in [l for l in hyp.split("\n") if l.strip().startswith("|")][2:] if r.strip("| -")]
        if not rows:
            rep.err(page, "'仮説との照合' has no table (if the user skipped, write 仮説なしで作成（照合なし）).")
        for r in rows:
            verdict = r.strip().strip("|").split("|")[-1].strip()
            if verdict not in VERDICTS:
                rep.err(page, f"verdict '{verdict}' is not allowed; use one of {' / '.join(sorted(VERDICTS))}.")
    if raw and "???" not in raw and "仮説なし" not in raw:
        rep.warn(page, "put '事前仮説（原文）' inside a ??? quote collapsible.")


def check_flow(page, secs, kinds, repo, rep) -> None:
    need_diagram(secs, kinds, "主な処理の流れ", {"sequenceDiagram"}, "sequenceDiagram", page, rep)
    need_diagram(secs, kinds, "分岐と失敗時の動き", {"flowchart", "graph"}, "flowchart", page, rep)


def check_design(page, secs, kinds, repo, rep) -> None:
    need_diagram(secs, kinds, "構成と責務", None, "diagram", page, rep)
    decisions = h3_blocks(secs.get("設計判断", ""), "判断")
    if not decisions and not secs.get("設計判断", "").strip().startswith("該当なし"):
        rep.err(page, "'設計判断' has no '### 判断: ...' items.")
    for d in decisions:
        if not BADGE_RE.search(d):
            rep.err(page, f"'{title(d)}': reason has no label ({LABEL_HINT}).")


def check_review(page, secs, kinds, repo, rep) -> None:
    for b in h3_blocks(secs.get("怪しい箇所", "")):
        if not SRC_RE.search(b):
            rep.err(page, f"'{title(b)}': no [[path:line]] reference.")
        if "確認方法" not in b:
            rep.err(page, f"'{title(b)}': no 確認方法.")
        if not BADGE_RE.search(b):
            rep.err(page, f"'{title(b)}': no certainty label.")
    if "差分の外への影響" not in secs:   # reports scaffolded before this section existed
        return
    text = secs["差分の外への影響"]
    if "探し方" not in text:
        rep.err(page, "'差分の外への影響' must state how you searched (**探し方:** ...), even when 該当なし.")
    if text.strip().startswith("該当なし"):
        return
    items = h3_blocks(text, "影響")
    if not items:
        rep.err(page, "'差分の外への影響' has no '### 影響: ...' items (or write 該当なし（探し方: ...）).")
    for b in items:
        if not BADGE_RE.search(b):
            rep.err(page, f"'{title(b)}': no certainty label.")
        if "changed_ranges" in repo.meta and not any(repo.outside_changed(*r) for r in refs(b)):
            rep.err(page, f"'{title(b)}': cites only changed lines. Point to the unchanged code "
                          "whose behavior changes (意味が変わる既存コード).")


def check_counted(page, secs, heading, prefix, lo, hi, what, rep):
    items = h3_blocks(secs.get(heading, ""), prefix)
    if not items:
        rep.err(page, f"no '### {prefix}{'1' if prefix == 'Q' and page == 'quiz.md' else ''}. ...' questions.")
    elif not lo <= len(items) <= hi:
        rep.warn(page, f"{len(items)} {what} (target {lo}-{hi}{'; never pad' if page == 'faq.md' else ''}).")
    return items


def check_faq(page, secs, kinds, repo, rep) -> None:
    for q in check_counted(page, secs, "質問一覧", "Q", 5, 8, "questions", rep):
        if "**即答:**" not in q and "**即答：**" not in q:
            rep.err(page, f"'{title(q)}': no '**即答:**'.")


def check_quiz(page, secs, kinds, repo, rep) -> None:
    for q in check_counted(page, secs, "問題", "Q", 5, 7, "quiz questions", rep):
        if not re.search(r'^\?\?\?\+?\s+\w+\s+"', q, re.M):
            rep.err(page, f"'{title(q)}': answer is not in a ??? collapsible.")
        if "読み直す場所" not in q:
            rep.warn(page, f"'{title(q)}': no 読み直す場所.")


def check_evidence(page, secs, kinds, repo, rep) -> None:
    v = secs.get("別コンテキスト検証", "")
    if v and "実施" not in v:
        rep.err(page, "'別コンテキスト検証' must state 実施 or 未実施.")


PAGE_CHECKS = {"index.md": check_index, "flow.md": check_flow, "design.md": check_design,
               "review.md": check_review, "faq.md": check_faq, "quiz.md": check_quiz, "evidence.md": check_evidence}


# ---------------------------------------------------------------- main

def validate(report_dir: Path, meta: dict) -> Report:
    repo, rep = Repo(meta), Report()
    if not meta.get("uncommitted"):
        code, now, _ = git(repo.root, "rev-parse", "HEAD")
        if code == 0 and now != meta["head"]:
            rep.warn("all", f"current HEAD ({now[:8]}) differs from the report target ({meta['head'][:8]}).")
    body_chars = 0
    for page in PAGES:
        p = report_dir / "docs" / page
        if not p.exists():
            rep.err(page, "page missing.")
            continue
        text = p.read_text(encoding="utf-8")
        if page != "evidence.md":
            body_chars += len(text)
        # Section checks see only what readers see: HTML comments (FILL hints, hidden text) are removed first.
        secs, raw_secs = sections(visible_text(text)), sections(text)
        for h in required_headings(page, meta):
            if h not in secs:
                rep.err(page, f"required heading '## {h}' is missing (never rename template headings).")
            elif not secs[h].strip() and "<!-- FILL" not in raw_secs.get(h, ""):   # FILL is reported below
                rep.err(page, f"'## {h}' is empty; write 該当なし if there is nothing.")
        kinds = check_page(page, text, repo, rep)
        if page in PAGE_CHECKS:
            PAGE_CHECKS[page](page, secs, kinds, repo, rep)
    if body_chars > MAX_BODY_CHARS:
        rep.warn("all", f"body is {body_chars} chars (target <= {MAX_BODY_CHARS:,} excluding evidence.md). "
                        "Shorten 低 findings to one line; replace re-explanations with links.")
    return rep


def main() -> int:
    setup_stdio()
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    report_dir = Path(sys.argv[1]).resolve()
    meta = load_meta(report_dir)
    if meta is None:
        print(f"ERROR: no impl-explainer-meta.json in {report_dir}; pass a report created by new_report.py.")
        return 2
    rep = validate(report_dir, meta)
    for w in rep.warnings:
        print("WARNING", w)
    for e in rep.errors:
        print("ERROR  ", e)
    print(f"\nFormat check: ERROR {len(rep.errors)} / WARNING {len(rep.warnings)} "
          "(format only; content correctness is NOT verified)")
    return 1 if rep.errors else 0


if __name__ == "__main__":
    sys.exit(main())
