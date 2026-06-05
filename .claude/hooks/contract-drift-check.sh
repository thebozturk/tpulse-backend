#!/bin/bash
# profiles/backend/.claude/hooks/contract-drift-check.sh
# PostToolUse (Write) event'inde çalışır.
# DTO veya controller dosyası değiştiğinde openapi.json'ın eski kalıp kalmadığını kontrol eder.
# Sadece UYARI verir — engel değil. /contract-publish komutu ile senkronlanır.

set -eu

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_ROOT" 2>/dev/null || exit 0

INPUT=$(cat)
if command -v jq &>/dev/null; then
  FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
else
  FILE=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/^"file_path":"//;s/"$//')
fi

[ -z "$FILE" ] && exit 0

# Sadece contract'ı etkileyecek dosyalar için çalış
case "$FILE" in
  *.controller.ts|*.dto.ts) ;;
  *) exit 0 ;;
esac

# openapi.json dosyasının konumunu bul
OPENAPI=""
for candidate in \
    "openapi.json" \
    "contract/openapi.json" \
    "../contract/openapi.json" \
    "../contract-repo/openapi.json" \
    ".factory/contract/openapi.json"; do
  if [ -f "$candidate" ]; then
    OPENAPI="$candidate"
    break
  fi
done

# Contract yoksa hiçbir şey yapma — /contract-publish önerisi
if [ -z "$OPENAPI" ]; then
  # İlk kez contract etkileyen dosya değiştirildiyse öneri
  if [ ! -f ".factory/memory/.contract-warned" ]; then
    echo "ℹ️  Contract dosyası (openapi.json) bulunamadı." >&2
    echo "   Frontend'e type export etmek için: /contract-publish" >&2
    touch ".factory/memory/.contract-warned" 2>/dev/null || true
  fi
  exit 0
fi

# DTO/controller'ın mtime'ı openapi.json'dan yeni mi?
if [ "$FILE" -nt "$OPENAPI" ]; then
  echo "⚠️  CONTRACT DRIFT: $FILE değişti ama $OPENAPI eski." >&2
  echo "   Frontend tipleri senkron olmayabilir. Çözüm:" >&2
  echo "     /contract-publish" >&2
fi

exit 0
