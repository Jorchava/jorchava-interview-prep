#!/usr/bin/env bash
# scripts/start-session.sh
#
# Solves a specific, recurring problem: accidentally starting a new
# session's work in the wrong branch (often `dev` directly) and having to
# stash/move changes afterward. This script does NOT automate away the
# human review checkpoint between sessions — it only automates the
# mechanical safety checks around branch creation. You still decide when
# to run it and what branch name to give it.
#
# Usage:
#   ./scripts/start-session.sh session-7-polish
#   ./scripts/start-session.sh bugfix-history-persistence
#   ./scripts/start-session.sh feature-free-spins-retrigger dev
#     (third arg optional — base branch to branch FROM; defaults to dev)

set -euo pipefail

BRANCH_NAME="${1:-}"
BASE_BRANCH="${2:-dev}"

if [ -z "$BRANCH_NAME" ]; then
  echo "Usage: ./scripts/start-session.sh <branch-name> [base-branch]"
  echo "Example: ./scripts/start-session.sh session-7-polish"
  exit 1
fi

echo "── Safety checks ──────────────────────────────────────────────"

# 1. Refuse to run with uncommitted changes — this is the exact scenario
#    that causes "I made changes in the wrong branch" problems.
if [ -n "$(git status --porcelain)" ]; then
  echo "STOP: You have uncommitted changes. Commit, stash, or discard them"
  echo "      before starting a new session branch."
  git status --short
  exit 1
fi
echo "OK  Working tree is clean."

# 2. Confirm current branch, so there's no ambiguity about starting point.
CURRENT_BRANCH="$(git branch --show-current)"
echo "OK  Currently on: $CURRENT_BRANCH"

# 3. Fetch latest before branching, so the new branch starts from an
#    up-to-date base rather than a stale local copy.
echo "── Fetching latest ────────────────────────────────────────────"
git fetch origin "$BASE_BRANCH"

# 4. Confirm the base branch exists locally and is up to date before
#    branching from it.
git checkout "$BASE_BRANCH"
git pull origin "$BASE_BRANCH"

# 5. Warn (don't block) if the base branch is behind an unmerged feature
#    branch that a previous session's PR hasn't been merged into yet —
#    this is the specific failure mode flagged when considering full
#    automation: branching from a stale base silently loses prior work.
UNMERGED_FEATURE_BRANCHES="$(git branch -r --no-merged "origin/$BASE_BRANCH" | grep -v HEAD || true)"
if [ -n "$UNMERGED_FEATURE_BRANCHES" ]; then
  echo ""
  echo "NOTE: These remote branches are NOT yet merged into $BASE_BRANCH:"
  echo "$UNMERGED_FEATURE_BRANCHES"
  echo "If your new session depends on work in one of those branches,"
  echo "branch from that feature branch instead of $BASE_BRANCH:"
  echo "  ./scripts/start-session.sh $BRANCH_NAME <that-branch-name>"
  echo ""
  read -p "Continue branching from $BASE_BRANCH anyway? [y/N] " CONFIRM
  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Aborted. No branch created."
    exit 1
  fi
fi

# 6. Create the new branch with a consistent naming convention.
git checkout -b "feature/$BRANCH_NAME"
git push -u origin "feature/$BRANCH_NAME"

echo ""
echo "── Ready ───────────────────────────────────────────────────────"
echo "Branch:  feature/$BRANCH_NAME"
echo "Based on: $BASE_BRANCH (up to date as of this run)"
echo ""
echo "Next: paste the session prompt into Open Code and begin."
