#!/bin/bash
# post-compact.sh
# Claude Code context compaction yaptıktan sonra tetiklenir.
# İki katmanlı hafıza stratejisi:
#   1. STDOUT → anında context'e enjekte
#   2. CLAUDE.md'ye yaz → Claude Code bunu diskten yeniden okur (resmi davranış)
#
# Bu sayede 4 saatlik bir session'da bile hiçbir kritik karar kaybolmaz.

set -eu

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_ROOT" 2>/dev/null || exit 0

# ─── KATMAN 1: stdout — anında context ────────────────────────────────
echo "=== POST-COMPACT ==="

# Proje başlığı (CLAUDE.md'nin ilk 3 satırı)
if [ -f CLAUDE.md ]; then
  head -3 CLAUDE.md 2>/dev/null
fi

# Aktif görev
if [ -f .factory/memory/active-task.md ]; then
  echo "Aktif görev:"
  head -5 .factory/memory/active-task.md 2>/dev/null
fi

# Git state
if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  echo "Branch: $(git branch --show-current 2>/dev/null || echo '?')"
  echo "Son: $(git log --oneline -1 2>/dev/null || echo 'commit yok')"
fi

echo "=== END ==="

# ─── KATMAN 2: CLAUDE.md'ye persist ───────────────────────────────────
# Claude Code her compaction sonrası CLAUDE.md'yi diskten yeniden okur.
# Bu blok her seferinde silinip yeniden yazılır — eski bilgi birikmez.

CLAUDE_FILE="CLAUDE.md"
[ -f "$CLAUDE_FILE" ] || exit 0

# Eski SESSION STATE bloğunu temizle (varsa)
# sed'in -i davranışı macOS ile Linux'ta farklı — tmp file kullan.
TMP=$(mktemp) || exit 0
awk '
  /<!-- SESSION STATE -->/ { skip=1; next }
  /<!-- END SESSION STATE -->/ { skip=0; next }
  !skip { print }
' "$CLAUDE_FILE" > "$TMP" 2>/dev/null && mv "$TMP" "$CLAUDE_FILE" 2>/dev/null || rm -f "$TMP"

# Yeni state bloğu hazırla
{
  echo ""
  echo "<!-- SESSION STATE -->"

  if [ -f .factory/memory/active-task.md ]; then
    TASK_FIRST=$(head -3 .factory/memory/active-task.md 2>/dev/null | tr '\n' ' ')
    echo "Aktif: $TASK_FIRST"
  fi

  if command -v git >/dev/null 2>&1 && [ -d .git ]; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "?")
    LAST=$(git log --oneline -1 2>/dev/null || echo "yok")
    echo "Branch: $BRANCH | Son: $LAST"
    echo ""
    echo "Son 3 commit:"
    git log --oneline -3 2>/dev/null | sed 's/^/- /' || true
  fi

  # Tekrarlayan hata varsa ekle
  if [ -s .factory/memory/error-log.jsonl ]; then
    RECENT=$(tail -20 .factory/memory/error-log.jsonl 2>/dev/null | \
      grep -oE '"pattern":"[^"]*"' | \
      sort | uniq -c | \
      awk '$1 >= 3 { gsub(/"pattern":"|"/,"",$2); printf "%s(%dx) ", $2, $1 }')
    if [ -n "$RECENT" ]; then
      echo ""
      echo "Tekrarlayan: $RECENT"
    fi
  fi

  echo "<!-- END SESSION STATE -->"
} >> "$CLAUDE_FILE"
