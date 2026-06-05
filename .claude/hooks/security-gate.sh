#!/bin/bash
# profiles/backend/.claude/hooks/security-gate.sh
# PostToolUse (Write) event'inde çalışır — post-write-check'ten ayrı bir hook.
# Ciddi güvenlik ihlali varsa exit 2 ile BLOKLAR (dosya yazıldı ama agent uyarılır).
#
# KRİTİK: Bu hook "advisory" değil, deterministik. Hardcoded secret, password leak,
# veya .env commit'i gibi durumlarda KESİNLİKLE blok eder.

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
[ -f "$FILE" ] || exit 0

CONTENT=$(cat "$FILE" 2>/dev/null)
VIOLATIONS=""

# ─── 1. Hardcoded secret — CRITICAL ──────────────────────────────────
# Gerçek secret pattern'leri (false positive'i minimize etmek için spesifik)
# eslint-disable veya "example" varsa skip
if echo "$CONTENT" | grep -qE 'eslint-disable|\.example\.|example\s*=|EXAMPLE|placeholder'; then
  : # Skip için flag
fi

# JWT_SECRET = "real-looking-string"
if echo "$CONTENT" | grep -qE "JWT_SECRET\s*=\s*['\"][a-zA-Z0-9]{16,}['\"]" && \
   ! echo "$CONTENT" | grep -qE "process\.env|\.env|EXAMPLE|example"; then
  VIOLATIONS="${VIOLATIONS}🔴 BLOCKED: JWT_SECRET hardcoded. process.env.JWT_SECRET kullan.
"
fi

# API key hardcoded
if echo "$CONTENT" | grep -qiE "(api.?key|access.?token|client.?secret)\s*=\s*['\"][A-Za-z0-9_-]{20,}['\"]" && \
   ! echo "$CONTENT" | grep -qE "process\.env|example|EXAMPLE|placeholder"; then
  VIOLATIONS="${VIOLATIONS}🔴 BLOCKED: API key/secret hardcoded görünüyor. process.env kullan.
"
fi

# AWS credentials
if echo "$CONTENT" | grep -qE "AKIA[0-9A-Z]{16}" || \
   echo "$CONTENT" | grep -qE "aws_secret_access_key\s*=\s*['\"][A-Za-z0-9/+=]{40}['\"]"; then
  VIOLATIONS="${VIOLATIONS}🔴 BLOCKED: AWS credentials hardcoded. AWS SDK env'den okur, kaldır.
"
fi

# Database URL hardcoded (mongodb://, postgres://)
if echo "$CONTENT" | grep -qE "['\"](mongodb|postgres|mysql|redis)://[^/\"']*:[^@\"']+@[^'\"]+['\"]" && \
   ! echo "$CONTENT" | grep -qE "process\.env|example"; then
  VIOLATIONS="${VIOLATIONS}🔴 BLOCKED: Database connection string kredensiyeli hardcoded. process.env kullan.
"
fi

# ─── 2. Schema'da password field'i select:false olmadan — CRITICAL ───
case "$FILE" in
  *.schema.ts)
    # password/refreshToken field var + select:false yok
    if echo "$CONTENT" | grep -qE "(password|refreshToken|mfaSecret)\s*:\s*(string|String)" && \
       ! echo "$CONTENT" | grep -q "select:\s*false"; then
      VIOLATIONS="${VIOLATIONS}🔴 BLOCKED: Schema'da password/token field'ı var ama select:false yok.
  Düzeltme: @Prop({ select: false }) password: string;
"
    fi
    ;;
esac

# ─── 3. Production kod içinde .env değişikliği — CRITICAL ────────────
case "$FILE" in
  .env|.env.production|.env.prod)
    VIOLATIONS="${VIOLATIONS}🔴 BLOCKED: Production .env dosyasına yazılıyor. Sadece .env.example düzenle.
"
    ;;
esac

# ─── 4. CORS wildcard + credentials:true — CRITICAL ──────────────────
# origin:"*" VE credentials:true aynı anda CSRF felaketi
if echo "$CONTENT" | grep -qE "origin:\s*['\"]\*['\"]" && \
   echo "$CONTENT" | grep -qE "credentials:\s*true"; then
  VIOLATIONS="${VIOLATIONS}🔴 BLOCKED: CORS origin:'*' + credentials:true — bu kombinasyon CSRF açığı.
  Düzeltme: whitelist origin'ler kullan.
"
fi

# ─── 5. eval() veya Function constructor kullanımı — CRITICAL ────────
if echo "$CONTENT" | grep -qE "\beval\s*\(|new\s+Function\s*\("; then
  VIOLATIONS="${VIOLATIONS}🔴 BLOCKED: eval() veya Function constructor — code injection vektörü.
"
fi

# ─── 6. child_process exec user input ile — CRITICAL ────────────────
if echo "$CONTENT" | grep -qE "exec\(\s*['\`].*\\\$\{.*\}" && \
   ! echo "$CONTENT" | grep -q "execFile"; then
  VIOLATIONS="${VIOLATIONS}🔴 BLOCKED: child_process.exec() template string ile — command injection riski.
  execFile() kullan ve argümanları array olarak geç.
"
fi

# ─── 7. main.ts: helmet/cors/csrf olmadan app.listen — CRITICAL ──────
case "$FILE" in
  */main.ts|main.ts)
    # app.listen var ama helmet yok
    if echo "$CONTENT" | grep -q "app.listen\|app\.useGlobalPipes"; then
      MISSING=""
      echo "$CONTENT" | grep -q "helmet\|@nestjs/helmet\|import.*helmet" || MISSING="${MISSING}helmet "
      echo "$CONTENT" | grep -q "cors\|enableCors" || MISSING="${MISSING}cors "
      # ValidationPipe zorunlu değil mi? Global olması tavsiye
      if [ -n "$MISSING" ]; then
        VIOLATIONS="${VIOLATIONS}🔴 BLOCKED: main.ts'te eksik güvenlik middleware: $MISSING
  Her biri için security skill'lerine bak: .factory/skills/security/
"
      fi
    fi
    ;;
esac

# ─── 8. Public endpoint + @Throttle yok — WARNING seviyesi ─────────
# Bu CRITICAL değil ama agent'ın görmesi lazım — exit 0 ile geç
case "$FILE" in
  *.controller.ts)
    if echo "$CONTENT" | grep -q "@Public()" && \
       ! echo "$CONTENT" | grep -q "@Throttle"; then
      echo "⚠️  SECURITY: Public endpoint'te @Throttle yok — bot saldırısına açık." >&2
    fi
    ;;
esac

# ─── 9. Prisma raw SQL — $queryRawUnsafe kontrol ──────────────────────
# $queryRawUnsafe + string concat = SQL injection riski
case "$FILE" in
  *.ts)
    # $queryRawUnsafe veya $executeRawUnsafe pattern
    if echo "$CONTENT" | grep -qE '\$(query|execute)RawUnsafe\s*\('; then
      # Template literal kullanılmış mı (backtick) — o zaman string concat zorlu
      # ama yine de Unsafe = warning
      VIOLATIONS+="🔴 [PRISMA-RAW-UNSAFE] \$queryRawUnsafe / \$executeRawUnsafe kullanımı tespit edildi.
   SQL injection riski. Kullanım:
   - Template literal: prisma.\$queryRaw\`SELECT * FROM users WHERE id = \${id}\`
   - User input → ASLA Unsafe variant'a sokma.
   Detay: .factory/skills/prisma/queries.md → 'Raw SQL'
"
    fi

    # $queryRaw + string interpolation (template'i kötüye kullanım)
    # Pattern: $queryRaw(`...${userInput}...`) — backtick içinde direkt input
    # Bu actually safe (Prisma escape eder) — bu kontrolü atlıyoruz, false positive yüksek

    # Prisma findFirst without where (mass exposure)
    if echo "$CONTENT" | grep -qE '\.(findFirst|findFirstOrThrow)\s*\(\s*\)' || \
       echo "$CONTENT" | grep -qE '\.(findFirst|findFirstOrThrow)\s*\(\s*\{\s*\}\s*\)'; then
      VIOLATIONS+="🔴 [PRISMA-MASS-EXPOSURE] findFirst() arguments boş — random/ilk record dönecek.
   Multi-tenant projede: tenant leak. User-spesifik query'de: yanlış kullanıcı.
   Fix: where clause ZORUNLU — { where: { orgId, ... } }
"
    fi
    ;;
esac

# ─── 10. DATABASE_URL kod içinde hardcode ─────────────────────────────
case "$FILE" in
  *.ts|*.js|*.prisma)
    # DATABASE_URL hem `=` (assignment) hem `:` (object literal) — hardcoded postgresql://
    if echo "$CONTENT" | grep -qE 'DATABASE_URL\s*[=:]\s*["\047]postgresql://' && \
       ! echo "$CONTENT" | grep -qE '\.example|placeholder|YOUR_|<.*>|env\.DATABASE_URL|process\.env'; then
      VIOLATIONS+="🔴 [DB-URL-HARDCODE] DATABASE_URL hardcoded postgresql:// connection string.
   .env veya .env.example placeholder kullan.
   Fix: env.DATABASE_URL veya process.env.DATABASE_URL
"
    fi
    ;;
esac

# ─── İhlal varsa BLOCK ────────────────────────────────────────────────
if [ -n "$VIOLATIONS" ]; then
  echo "=== SECURITY GATE: $FILE ===" >&2
  printf "%s" "$VIOLATIONS" >&2
  echo "" >&2
  echo "Bu dosya yazıldı ama CRITICAL güvenlik ihlali içeriyor." >&2
  echo "DÜZELTMEDEN COMMIT ETME. Hook bir sonraki yazmayı BLOCK edebilir." >&2
  exit 2
fi

exit 0
