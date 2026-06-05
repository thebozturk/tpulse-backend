#!/bin/bash
# enrich-prompt.sh
# Kullanıcı her mesaj gönderdiğinde tetiklenir (UserPromptSubmit event).
# stdin'den JSON alır: {"prompt":"..."}
# stdout'a yazılan her satır agent'ın context'ine enjekte edilir.
#
# GÖREV:
# 1. Prompt'taki keyword'leri tespit et
# 2. Registry'den eşleşen skill dosyalarını bul (MAX 3)
# 3. Aktif görev varsa scope creep kontrolü yap
# 4. Generic convention hatırlatması (sadece gerekirse)
#
# KRİTİK: Max 3 match kuralı. Daha fazlası context'i kirletir.

set -eu

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_ROOT" 2>/dev/null || exit 0

# ─── Stdin'den prompt oku ─────────────────────────────────────────────
INPUT=$(cat)

# jq varsa kullan, yoksa grep fallback
if command -v jq &>/dev/null; then
  PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || echo "")
else
  PROMPT=$(echo "$INPUT" | grep -o '"prompt":"[^"]*"' | head -1 | sed 's/^"prompt":"//;s/"$//')
fi

[ -z "$PROMPT" ] && exit 0

# Lowercase for matching
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# ─── Çıktı buffer ─────────────────────────────────────────────────────
CONTEXT=""
MATCH_COUNT=0
MAX_MATCHES=3

add_context() {
  if [ "$MATCH_COUNT" -lt "$MAX_MATCHES" ]; then
    CONTEXT="${CONTEXT}$1
"
    MATCH_COUNT=$((MATCH_COUNT + 1))
  fi
}

matches_any() {
  local needle
  for needle in "$@"; do
    case "$PROMPT_LOWER" in
      *"$needle"*) return 0 ;;
    esac
  done
  return 1
}

# ─── Workflow keyword'leri (generic — stack'ten bağımsız) ─────────────
# Önce bunları kontrol et, sonra registry-based matching.
# Sadece AÇIK keyword match'i varsa enjekte et.

if matches_any "plan" "decompose" "break down" "parçala" "böl"; then
  if [ -f .factory/skills/workflows/decomposition.md ]; then
    add_context "[WORKFLOW] .factory/skills/workflows/decomposition.md oku"
  fi
fi

if matches_any "git" "branch" "commit" "merge" "rebase"; then
  if [ -f .factory/skills/workflows/git-flow.md ]; then
    add_context "[GIT] .factory/skills/workflows/git-flow.md oku"
  fi
fi

# ─── Registry-based dynamic matching ──────────────────────────────────
# .factory/memory/registry.json içinde skill'lerin keyword'leri kayıtlı.
# Session-start bu dosyayı günceller.

if [ -f .factory/memory/registry.json ] && command -v jq &>/dev/null && [ "$MATCH_COUNT" -lt "$MAX_MATCHES" ]; then
  # Her entry için keywords'leri al, prompt'la karşılaştır
  while IFS=$'\t' read -r path keywords; do
    [ -z "$keywords" ] && continue
    [ "$MATCH_COUNT" -ge "$MAX_MATCHES" ] && break

    # Keywords'ü virgülle ayır, her birini dene
    old_ifs="$IFS"; IFS=','
    # shellcheck disable=SC2086
    set -- $keywords
    IFS="$old_ifs"

    for kw in "$@"; do
      kw=$(echo "$kw" | xargs | tr '[:upper:]' '[:lower:]')
      [ -z "$kw" ] && continue
      [ ${#kw} -lt 3 ] && continue  # çok kısa keyword'leri atla

      case "$PROMPT_LOWER" in
        *"$kw"*)
          add_context "[SKILL] $path oku"
          break 2
          ;;
      esac
    done
  done < <(jq -r '.entries[]? | "\(.path)\t\(.keywords)"' .factory/memory/registry.json 2>/dev/null)
fi

# ─── Scope creep kontrolü ─────────────────────────────────────────────
# Aktif bir /build var ve kullanıcı "ayrıca", "bir de" gibi kelime kullanıyorsa uyar.

if [ -f .factory/memory/active-task.md ]; then
  HAS_ACTIVE=$(grep -m1 "^## Aktif" .factory/memory/active-task.md 2>/dev/null || true)
  if [ -n "$HAS_ACTIVE" ]; then
    if matches_any "ayrıca" "bir de" "ek olarak" "also" "plus" "and also" "bonus"; then
      CONTEXT="${CONTEXT}[SCOPE] Aktif bir görev var. Yeni özellik spec'in kapsamında mı kontrol et.
"
    fi
  fi
fi

# ─── Convention hatırlatma (sadece ilk kod yazma sinyalinde) ──────────
# "Yaz", "oluştur", "ekle" gibi yazma kelimesi varsa convention'ları hatırlat.

if matches_any "yaz " "oluştur" "implement" "create" "add " "write "; then
  if [ -f .factory/memory/conventions.json ] && command -v jq &>/dev/null; then
    # Conventions dolu mu?
    NAMING=$(jq -r '.naming // empty' .factory/memory/conventions.json 2>/dev/null)
    if [ -n "$NAMING" ] && [ "$NAMING" != "null" ] && [ "$NAMING" != "{}" ]; then
      CONTEXT="${CONTEXT}[CONV] .factory/memory/conventions.json'daki naming ve pattern'ları takip et.
"
    fi
  fi
fi

# ─── Çıktı ────────────────────────────────────────────────────────────
if [ -n "$CONTEXT" ]; then
  printf "%s" "$CONTEXT"
fi
