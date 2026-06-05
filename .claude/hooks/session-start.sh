#!/bin/bash
# session-start.sh
# Claude Code her session başında (ilk açılış ve compaction sonrası) çalıştırır.
# stdout → agent'ın context'ine enjekte edilir.
#
# Matcher: "" (her session) ve "compact" (compaction sonrası) ayrı hook'lar
# olarak settings.json'da tanımlıdır. Bu script her ikisinde de çalışır,
# ama compaction'da kısa özet, normal açılışta biraz daha detay verir.
#
# HEDEF: Max 200 token çıktı. Detay dosyada, burada sadece özet.

set -eu

# Project root'u bul (hook'un çağrıldığı dizinden yukarı çık)
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_ROOT" 2>/dev/null || exit 0

# ─── Başlık ───────────────────────────────────────────────────────────
echo "=== FACTORY ==="

# ─── İlk kullanım tespiti ─────────────────────────────────────────────
if [ ! -f .factory/memory/session-handoff.md ] && \
   [ ! -s .factory/memory/error-log.jsonl ] && \
   [ ! -s .factory/memory/conventions.json 2>/dev/null -o "$(cat .factory/memory/conventions.json 2>/dev/null)" = "{}" ]; then
  echo "👋 Factory kurulu, hoş geldin."
  echo "   İlk adım: /onboard (mevcut projeyi analiz eder)"
  echo "=== END ==="
  exit 0
fi

# ─── Handoff özeti (son session'dan) ──────────────────────────────────
if [ -f .factory/memory/session-handoff.md ]; then
  # Sadece ilk 2 satır — "Son: ..." ve "Branch: ..."
  head -2 .factory/memory/session-handoff.md 2>/dev/null
fi

# ─── Aktif görev ──────────────────────────────────────────────────────
if [ -f .factory/memory/active-task.md ]; then
  # İlk "## Aktif" satırını bul
  TASK=$(grep -m1 "^## Aktif" .factory/memory/active-task.md 2>/dev/null || true)
  [ -n "$TASK" ] && echo "$TASK"
fi

# ─── Git durumu ───────────────────────────────────────────────────────
if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "?")
  LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "commit yok")
  CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

  echo "Branch: $BRANCH"
  [ "$CHANGES" -gt 0 ] && echo "Uncommitted: $CHANGES dosya"
  echo "Son: $LAST_COMMIT"
fi

# ─── Tekrarlayan hatalar (son 20 entry) ───────────────────────────────
if [ -s .factory/memory/error-log.jsonl ]; then
  # Son 20 kaydı al, pattern'leri say, 3+ tekrarı göster
  RECENT=$(tail -20 .factory/memory/error-log.jsonl 2>/dev/null | \
    grep -oE '"pattern":"[^"]*"' | \
    sort | uniq -c | \
    awk '$1 >= 3 { gsub(/"pattern":"|"/,"",$2); printf "%s(%dx) ", $2, $1 }')

  if [ -n "$RECENT" ]; then
    echo "Dikkat (tekrarlayan): $RECENT"
  fi
fi

# ─── Registry cache kontrolü — skill discovery için ──────────────────
# Registry yoksa veya dosya sayısı değişmişse yeniden oluştur.
# Bu iş ayrı bir script'te de olabilir; burada inline.
build_registry() {
  local registry=".factory/memory/registry.json"
  local hash_file=".factory/memory/registry-hash"

  [ -d .factory/skills ] || return

  # Mevcut tarama edilebilir dosyaların sayısını hesapla
  local current_count
  current_count=$(find .factory/skills .claude/agents .claude/skills 2>/dev/null \
                    -type f \( -name "*.md" -o -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | wc -l | tr -d ' ')
  current_count="${current_count:-0}"

  local cached_count
  cached_count=$(cat "$hash_file" 2>/dev/null || echo "0")

  if [ "$current_count" = "$cached_count" ] && [ -f "$registry" ]; then
    return  # Değişiklik yok
  fi

  # Yeniden tara
  mkdir -p "$(dirname "$registry")"
  {
    echo '{"entries":['
    local first=1
    while IFS= read -r -d '' file; do
      # YAML frontmatter'dan name, keywords, description çek
      if head -1 "$file" 2>/dev/null | grep -q "^---"; then
        local name keywords desc
        name=$(awk '/^---$/{c++;next} c==1 && /^name:/{sub(/^name:[[:space:]]*/,""); print; exit}' "$file" 2>/dev/null || echo "")
        keywords=$(awk '/^---$/{c++;next} c==1 && /^keywords:/{sub(/^keywords:[[:space:]]*"?/,""); sub(/"[[:space:]]*$/,""); print; exit}' "$file" 2>/dev/null || echo "")
        desc=$(awk '/^---$/{c++;next} c==1 && /^description:/{sub(/^description:[[:space:]]*"?/,""); sub(/"[[:space:]]*$/,""); print; exit}' "$file" 2>/dev/null || echo "")

        if [ -n "$name" ]; then
          [ $first -eq 0 ] && echo ","
          printf '  {"path":"%s","name":"%s","keywords":"%s","description":"%s"}' \
            "$file" "$name" "$keywords" "$desc"
          first=0
        fi
      fi
    done < <(find .factory/skills .claude/agents .claude/skills 2>/dev/null -type f -name "*.md" -print0 2>/dev/null)
    echo ''
    echo ']}'
  } > "$registry" 2>/dev/null || true

  echo "$current_count" > "$hash_file" 2>/dev/null || true
}

build_registry

echo "=== END ==="
