#!/bin/bash
# protect-branch.sh
# PreToolUse (Bash) event'inde tetiklenir.
# Stdin: {"tool_input":{"command":"..."}}
# Return: exit 0 → izin ver, exit 2 → ENGELLE (agent komutu çalıştıramaz)
#
# main/master/dev branch'lerinde doğrudan commit veya push'u engeller.
# Feature branch'e zorlar.

set -eu

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_ROOT" 2>/dev/null || exit 0

# Git repo değilse geç
[ -d .git ] || exit 0

# ─── Stdin parse ──────────────────────────────────────────────────────
INPUT=$(cat)

if command -v jq &>/dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
else
  COMMAND=$(echo "$INPUT" | grep -o '"command":"[^"]*"' | head -1 | sed 's/^"command":"//;s/"$//')
fi

[ -z "$COMMAND" ] && exit 0

# ─── Branch kontrolü ──────────────────────────────────────────────────
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
[ -z "$BRANCH" ] && exit 0

# Korunan branch'ler
case "$BRANCH" in
  main|master|develop|dev|production|prod|staging|release/*)
    # Commit veya push denemesi var mı?
    case "$COMMAND" in
      *"git commit"*|*"git push"*)
        # Allow --amend and similar? Hayır, komple blokla. Kullanıcı explicit
        # geçmek istiyorsa feature branch'e çıkmalı.
        echo "BLOCKED: '$BRANCH' branch'i korumalı. Feature branch'e çık:" >&2
        echo "  git checkout -b feature/<isim>" >&2
        exit 2
        ;;
    esac
    ;;
esac

exit 0
