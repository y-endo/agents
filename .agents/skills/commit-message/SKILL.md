---
name: commit-message
description: Generate a Japanese commit message from user context and the confirmed staged diff. Use when the user asks to create, draft, revise, suggest, or commit with a message. Inspect staged, unstaged, and untracked changes, confirm the ticket IDs and file scope, stage only exact approved paths, report included and excluded files, and commit only after separate explicit user approval of the final staged diff and message.
---

# Generate a Commit Message

Generate one commit message from the user's context and the confirmed staged diff.

## Commit Message Rules

Follow repository-specific commit rules when they exist.
Otherwise, use this format:

```text
[<type>] <ticket-id> <subject>

<body>
```

- Use common types when the repository defines none: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `style`, `chore`, or `revert`.
- Choose the type that best represents the staged diff.
- Use nonstandard types such as `add`, `modify`, or `remove` only when repository rules define them.
- Use the exact ticket IDs confirmed by the user, including capitalization and punctuation.
- Write the subject and body in Japanese. Keep the type, ticket IDs, and repository-required syntax unchanged.
- Keep the subject within 50 characters when practical and summarize the staged change.
- Write the body as bullet points describing the important changes.
- Follow the repository's established style for all other formatting.

Example:

```text
[perf] <TICKET-1234> ユーザー一覧取得を高速化

- N+1クエリをeager loadingで解消
- 変更後のAPIレスポンスに一覧表示を対応
```

## Workflow

1. Read repository instructions and commit conventions.
2. Inspect `git status --short`, staged changes, unstaged changes, and untracked files.
3. Report files already staged, files proposed for staging, and files proposed for exclusion.
4. Ask the user to confirm the exact ticket IDs and file scope.
5. If approved files are not staged, run `git add -- <exact-paths>` with only those paths.
6. Recheck `git status --short`, `git diff --cached --stat`, and `git diff --cached`.
7. Generate the message from the confirmed staged diff.
8. Present the exact staged scope and final message, then ask separately whether to commit that exact combination.
9. Stop and wait for an explicit answer. Run `git commit` only after the user clearly approves that exact staged diff and message.
10. After a successful commit, verify the result with `git status --short` and `git log -1 --oneline`.

Quote paths for the active shell.
Do not use `git add .`, `git add -A`, globs, broad directories, or `git add --force`.
If an excluded file is already staged, report the conflict and stop instead of unstaging it automatically.
Do not generate the final message until the user confirms both the ticket IDs and file scope.

## Commit Approval

Treat approval to stage files, a request to draft a message, a general instruction to continue, and permission given before the final staged diff and message were shown as insufficient permission to commit.
Never infer commit permission.
Do not run `git commit` in the same step that presents the message.
If the index or message changes after approval, present the revised staged scope and message and obtain explicit approval again.
Do not use `--amend`, `--no-verify`, or `--allow-empty` unless the user separately requests that behavior.
If a commit hook fails, report the failure and do not bypass it.

## Output

Report the following briefly:

- Confirmed ticket IDs
- Files included in the staged scope
- Files excluded from the staged scope
- Files staged by this skill, or `None`
- The proposed commit message in a copyable code block
- Whether explicit commit approval is still required
- The resulting commit hash after an approved successful commit, or a statement that no commit was created

Do not modify files, branches, refs, or the index except for the explicitly approved `git add -- <exact-paths>` operation and an explicitly approved commit of the exact staged diff with the exact presented message.
