#!/usr/bin/env bash
# Review a pull request with your local, logged in Claude and post the result
# as a PR comment. Usage: npm run review <pr number>
set -euo pipefail
pr="${1:?usage: npm run review <pr number>}"

{
  echo "Review this pull request by the rules in CLAUDE.md."
  echo "Don't repeat points already raised in the existing comments."
  echo
  echo "## Existing comments"
  gh pr view "$pr" --comments
  echo
  echo "## Diff"
  gh pr diff "$pr"
} | claude -p --max-turns 5 | gh pr comment "$pr" --body-file -
