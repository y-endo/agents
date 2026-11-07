"""MkDocs hook for impl-explainer.

- Turns 【確認済み】【推測】【未確認】 into colored badges.
- Turns [[path:line]] / [[path:line-line]] into editor links.
Code blocks and inline code are left untouched.
"""

import html
import re
from pathlib import Path

FENCE_RE = re.compile(r"^(\s*)(`{3,}|~{3,})")
INLINE_CODE_RE = re.compile(r"(`+)(.+?)\1")
SRC_RE = re.compile(r"\[\[([^\[\]:]+?):(\d+)(?:-(\d+))?\]\]")
BADGES = {
    "【確認済み】": ("ok", "確認済み"),
    "【推測】": ("guess", "推測"),
    "【未確認】": ("unknown", "未確認"),
}
EDITOR_URLS = {
    "vscode": "vscode://file/{path}:{line}",
    "cursor": "cursor://file/{path}:{line}",
    "jetbrains": "jetbrains://idea/navigate/reference?path={path}&line={line}",
}


def _convert_text(text: str, repo_root: str, editor: str) -> str:
    for token, (cls, label) in BADGES.items():
        text = text.replace(token, f'<span class="ie-badge ie-{cls}">{label}</span>')

    def src(m: re.Match) -> str:
        path, start, end = m.group(1).strip(), m.group(2), m.group(3)
        shown = html.escape(f"{path}:{start}" + (f"-{end}" if end else ""))
        url_tpl = EDITOR_URLS.get(editor)
        if not url_tpl or not repo_root:
            return f'<code class="ie-src">{shown}</code>'
        abs_path = (Path(repo_root) / path).as_posix()
        url = html.escape(url_tpl.format(path=abs_path, line=start), quote=True)
        return f'<a class="ie-src" href="{url}" title="エディタで開く"><code>{shown}</code></a>'

    return SRC_RE.sub(src, text)


def _convert_line(line: str, repo_root: str, editor: str) -> str:
    out, pos = [], 0
    for m in INLINE_CODE_RE.finditer(line):
        out.append(_convert_text(line[pos:m.start()], repo_root, editor))
        out.append(m.group(0))
        pos = m.end()
    out.append(_convert_text(line[pos:], repo_root, editor))
    return "".join(out)


def on_page_markdown(markdown, page, config, files):
    opts = (config.get("extra") or {}).get("impl_explainer") or {}
    repo_root, editor = opts.get("repo_root", ""), opts.get("editor", "vscode")
    lines, fence = [], None
    for line in markdown.split("\n"):
        m = FENCE_RE.match(line)
        if fence is None and m:
            fence = m.group(2)[0] * len(m.group(2))
            lines.append(line)
        elif fence is not None:
            if line.strip().startswith(fence) and line.strip() == line.strip()[0] * len(line.strip()):
                fence = None
            lines.append(line)
        else:
            lines.append(_convert_line(line, repo_root, editor))
    return "\n".join(lines)
