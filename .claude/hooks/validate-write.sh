#!/bin/bash
# profiles/backend/.claude/hooks/validate-write.sh
# PreToolUse (Write) event'inde çalışır.
# Stdin: {"tool_input":{"file_path":"..."}}
# Return: exit 0 = izin ver, exit 2 = ENGELLE
#
# NestJS + MongoDB projesi için yazma öncesi deterministik kontroller.

set -eu

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_ROOT" 2>/dev/null || exit 0

# ─── Stdin parse ──────────────────────────────────────────────────────
INPUT=$(cat)
if command -v jq &>/dev/null; then
  FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
else
  FILE=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/^"file_path":"//;s/"$//')
fi

[ -z "$FILE" ] && exit 0

# ─── Korumalı klasörler (shared deny'lere ek) ────────────────────────
case "$FILE" in
  */migrations/*.js|*/migrations/*.ts)
    # Migration zaten var mı kontrol et — aynı ad'a yazma
    BASENAME=$(basename "$FILE")
    EXISTS=$(find . -path "*/migrations/$BASENAME" -not -path "./node_modules/*" 2>/dev/null | head -1)
    if [ -n "$EXISTS" ] && [ "$EXISTS" != "./$FILE" ]; then
      echo "BLOCKED: Aynı isimli migration zaten var: $EXISTS" >&2
      echo "  Migration'lar forward-only. Yeni bir migration oluştur (timestamp prefix)." >&2
      exit 2
    fi
    ;;
  */node_modules/*|*/dist/*|*/coverage/*|*/.next/*)
    echo "BLOCKED: Generated/vendor klasöre yazma yasak: $FILE" >&2
    exit 2
    ;;
esac

# ─── .env koruması ────────────────────────────────────────────────────
case "$FILE" in
  *.env|*.env.production|*.env.local)
    # .env.example hariç gerçek .env dosyalarına yazma engelli
    if [ "$FILE" != ".env.example" ] && [[ "$FILE" != *".env.example" ]]; then
      echo "BLOCKED: Gerçek .env dosyasına yazma yasak: $FILE" >&2
      echo "  .env.example güncelle, secret'ları kullanıcı kendisi koysun." >&2
      exit 2
    fi
    ;;
esac

# ─── NestJS convention: feature-based module yapısı ───────────────────
# Eğer src/modules/ altında yazılıyorsa, doğru klasör yapısına uymalı
case "$FILE" in
  src/modules/*/*)
    # src/modules/<feature>/<file> formatında olmalı
    PATH_PARTS=$(echo "$FILE" | awk -F/ '{print NF}')
    if [ "$PATH_PARTS" -lt 4 ]; then
      # Olası: src/modules/foo.ts (feature klasörü yok)
      # Bu konvansiyon ihlali olabilir ama her zaman değil (örn: src/modules/index.ts)
      if [[ "$FILE" != *"/index.ts" ]] && [[ "$FILE" != *"/index.js" ]]; then
        echo "⚠️  Convention: NestJS feature modülü için src/modules/<feature>/... formatı beklenir." >&2
      fi
    fi
    ;;
esac

# ─── Schema convention ────────────────────────────────────────────────
# *.schema.ts dosyası src/modules/<feature>/schemas/ altında olmalı (varsa)
case "$FILE" in
  *.schema.ts)
    DIR=$(dirname "$FILE")
    if [[ "$DIR" != */schemas ]] && [[ "$DIR" != *"/src/modules/"* ]]; then
      # Yumuşak uyarı — belki yeni projede henüz schemas/ klasörü yok
      echo "ℹ️  Convention: Schema dosyası genelde src/modules/<feature>/schemas/ altına yazılır." >&2
    fi
    ;;
esac

# ─── Test dosyası zorunluluğu (öneri) ────────────────────────────────
# src/ altında .ts dosyası yazılıyorsa karşılık gelen .spec.ts aranır
# Bu SADECE uyarı — exit 0 ile izin verilir
case "$FILE" in
  src/*.ts|src/*.controller.ts|src/*.service.ts)
    # .spec.ts veya .test.ts dışındaki dosyalar için test ara
    if [[ "$FILE" != *.spec.ts ]] && [[ "$FILE" != *.test.ts ]] && [[ "$FILE" != *.d.ts ]]; then
      BASENAME=$(basename "$FILE" .ts)
      DIR=$(dirname "$FILE")
      # İlgili test dosyası yoksa not düş
      if [ ! -f "$DIR/$BASENAME.spec.ts" ] && [ ! -f "$DIR/$BASENAME.test.ts" ]; then
        # Sadece controller/service için uyar (dto, module için gerek yok)
        case "$FILE" in
          *.controller.ts|*.service.ts|*.guard.ts)
            echo "ℹ️  $BASENAME için test dosyası (*.spec.ts) bulunamadı. Build sonunda test yazılmalı." >&2
            ;;
        esac
      fi
    fi
    ;;
esac

# ─── Prisma schema convention ─────────────────────────────────────────
# schema.prisma yazma — naming convention check (warning, BLOCK değil)
BASENAME=$(basename "$FILE")
if [ "$BASENAME" = "schema.prisma" ]; then
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty' 2>/dev/null)
  if [ -n "$CONTENT" ]; then
    # Model isim PascalCase mı?
    BAD_MODEL=$(echo "$CONTENT" | grep -oE '^model\s+[a-z][a-zA-Z0-9_]*\s*\{' | head -1)
    if [ -n "$BAD_MODEL" ]; then
      MODEL_NAME=$(echo "$BAD_MODEL" | awk '{print $2}')
      echo "⚠️  Prisma convention: Model adı PascalCase olmalı, '$MODEL_NAME' lower-case." >&2
      echo "   Doğru: model User { ... }" >&2
    fi

    # snake_case @@map önerisi (eksikse)
    if echo "$CONTENT" | grep -qE '^model\s+[A-Z]' && ! echo "$CONTENT" | grep -qE '@@map\('; then
      echo "ℹ️  Prisma convention: @@map(\"plural_snake_case\") tablo adı için önerilir." >&2
    fi

    # Foreign key index uyarısı
    # Pattern: <field>Id String  ... bu satırdan sonra @relation(fields: [<field>Id]) varsa
    # ve aynı model'de @@index([<field>Id]) yoksa uyarı
    FK_FIELDS=$(echo "$CONTENT" | grep -oE '\bfields:\s*\[\s*[a-zA-Z][a-zA-Z0-9_]*Id\s*\]' | grep -oE '[a-zA-Z][a-zA-Z0-9_]*Id' | sort -u)
    if [ -n "$FK_FIELDS" ]; then
      while read -r FK; do
        [ -z "$FK" ] && continue
        if ! echo "$CONTENT" | grep -qE "@@index\(\s*\[\s*$FK"; then
          echo "ℹ️  Prisma: '$FK' foreign key için @@index([$FK]) eksik (Postgres FK auto-index DEĞİL)." >&2
        fi
      done <<< "$FK_FIELDS"
    fi
  fi
fi

# ─── Architectural pattern hints (v1.5.0) — warning seviyesi ──────────
# Yazma sırasında pattern ihlal sinyalleri — BLOCK etmiyor, eğitici uyarı
if [ -n "${CONTENT:-}" ] || command -v jq &>/dev/null; then
  CONTENT_FOR_PATTERNS=$(echo "$INPUT" | jq -r '.tool_input.content // empty' 2>/dev/null)

  if [ -n "$CONTENT_FOR_PATTERNS" ]; then
    case "$FILE" in
      *.controller.ts)
        # Anti-pattern 1: Controller'da if (featureFlag)
        if echo "$CONTENT_FOR_PATTERNS" | grep -qE 'if\s*\(\s*(this\.)?(flags|featureFlag|featureFlags)\.(get|isEnabled)'; then
          echo "⚠️  [ANTI-PATTERN] Controller'da feature flag if/else tespit edildi." >&2
          echo "   → Strategy + Factory pattern aday." >&2
          echo "   → patterns/strategy.md + patterns/factory.md oku." >&2
        fi
        ;;
      *.service.ts)
        # Anti-pattern 2: Service'de req/res
        if echo "$CONTENT_FOR_PATTERNS" | grep -qE '@(Req|Res)\(\)|:\s*Request[\s,)]|:\s*Response[\s,)]|req\.(body|query|params|headers|user)|res\.(json|status|send)'; then
          # Streaming için res context istisnası — "context.response" veya "ctx.res" varsa skip
          if ! echo "$CONTENT_FOR_PATTERNS" | grep -qE 'context\.response|ctx\.(res|response)|StreamingContext|CompletionContext'; then
            echo "⚠️  [ANTI-PATTERN] Service'de HTTP nesnesi (req/res) tespit edildi." >&2
            echo "   → Service HTTP'yi bilmemeli, controller HTTP'yi konuşur." >&2
            echo "   → patterns/service-layer.md → 'Sınır 1: HTTP'yi bilmez' oku." >&2
          fi
        fi
        ;;
      *.repository.ts)
        # Anti-pattern 3: Repository'de business logic
        if echo "$CONTENT_FOR_PATTERNS" | grep -qE 'if\s*\([^)]*(\.role|\.tier|\.premium|\.plan)\s*[=!]'; then
          echo "⚠️  [ANTI-PATTERN] Repository'de business logic (role/tier/premium check) tespit edildi." >&2
          echo "   → Karar service'te, repo sadece scoped query." >&2
          echo "   → patterns/repository.md → 'Sınır 1' oku." >&2
        fi
        # Anti-pattern 13: findById userId-less (ownership)
        if echo "$CONTENT_FOR_PATTERNS" | grep -qE 'findById\s*\(\s*[a-zA-Z]+\s*:\s*string\s*\)' && \
           ! echo "$CONTENT_FOR_PATTERNS" | grep -qE 'findByIdAndUserId|@@index.*userId|where:\s*\{\s*id.*userId'; then
          echo "⚠️  [SECURITY] findById() user filter olmadan — Broken Access Control riski." >&2
          echo "   → findByIdAndUserId(id, userId) imzası fail-safe sağlar." >&2
          echo "   → architecture/auth-authz-boundaries.md → 'Ownership check' oku." >&2
        fi
        ;;
    esac
  fi
fi

exit 0
