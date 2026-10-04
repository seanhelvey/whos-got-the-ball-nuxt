#!/usr/bin/env bash
# Review a pull request with your local, logged in Claude and post the result
# as a PR comment. Usage: npm run review <pr number>
set -euo pipefail
pr="${1:?usage: npm run review <pr number>}"

# The VS Code extension bundles its own claude binary without putting it on
# PATH, so fall back to the newest one it installed.
claude="${CLAUDE_BIN:-$(command -v claude || ls -d ~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude 2>/dev/null | sort -V | tail -1)}"
if [[ ! -x "$claude" ]]; then
  echo "claude not found. Install the CLI or set CLAUDE_BIN." >&2
  exit 1
fi

review="$({
  echo "Review this pull request by the rules in CLAUDE.md."
  echo "Don't repeat points already raised in the existing comments."
  echo
  echo "## Existing comments"
  gh pr view "$pr" --comments
  echo
  echo "## Diff"
  gh pr diff "$pr"
} | "$claude" -p --max-turns 5)"

if [[ -z "${review//[[:space:]]/}" ]]; then
  echo "Claude returned an empty review, nothing posted." >&2
  exit 1
fi
gh pr comment "$pr" --body "$review"
