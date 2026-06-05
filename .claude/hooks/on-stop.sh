#!/bin/bash
# on-stop.sh
# Session kapanırken tetiklenir (Stop event).
# session-handoff.md yazar — sonraki session buradan kaldığı yeri görür.

set -eu

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_ROOT" 2>/dev/null || exit 0

[ -d .factory/memory ] || exit 0

HANDOFF=".factory/memory/session-handoff.md"

DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BRANCH=""
COMMIT=""
UNCOMMITTED=""

if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "?")
  COMMIT=$(git log --oneline -1 2>/dev/null || echo "yok")
  UNCOMMITTED=$(git diff --name-only 2>/dev/null | head -5 | tr '\n' ', ' | sed 's/, $//')
fi

{
  echo "Son: $DATE"
  echo "Branch: $BRANCH"
  echo "Commit: $COMMIT"
  [ -n "$UNCOMMITTED" ] && echo "Uncommitted: $UNCOMMITTED"

  # Aktif görev varsa referans ver
  if [ -f .factory/memory/active-task.md ]; then
    TASK_TITLE=$(grep -m1 "^## Aktif" .factory/memory/active-task.md 2>/dev/null | sed 's/## //' || true)
    [ -n "$TASK_TITLE" ] && echo "Aktif görev: $TASK_TITLE"
  fi
} > "$HANDOFF"
