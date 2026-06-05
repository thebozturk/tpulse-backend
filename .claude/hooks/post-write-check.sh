#!/bin/bash
# profiles/backend/.claude/hooks/post-write-check.sh
# PostToolUse (Write) event'inde çalışır.
# Dosya yazıldıktan SONRA anti-pattern'ları tarar.
# stdout → agent'a uyarı olarak gösterilir.
# error-log.jsonl'e pattern kaydı düşer (self-learning için).

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

# Sadece TypeScript/JavaScript dosyalarını tara
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

# Test dosyalarını atla (farklı kurallar geçerli)
case "$FILE" in
  *.spec.ts|*.test.ts|*.spec.js|*.test.js) exit 0 ;;
esac

CONTENT=$(cat "$FILE" 2>/dev/null)
WARNINGS=""
MODULE=$(echo "$FILE" | grep -oE 'src/modules/[^/]+' 2>/dev/null | head -1 | sed 's#src/modules/##' || echo "unknown")

# ─── Helper: error-log'a pattern kaydet ───────────────────────────────
log_pattern() {
  local pattern="$1"
  local log=".factory/memory/error-log.jsonl"
  if [ -d .factory/memory ]; then
    TS=$(date -u +"%Y-%m-%d")
    echo "{\"ts\":\"$TS\",\"pattern\":\"$pattern\",\"file\":\"$FILE\",\"module\":\"$MODULE\"}" >> "$log"
  fi
}

# ─── 1. any type kullanımı ────────────────────────────────────────────
# grep -c exit 1 döndürürse set -e'yi tetikler; || true ile sarmalı
ANY_COUNT=$(echo "$CONTENT" | grep -c ': any\b\|\bas any\b' || true)
# eslint-disable olanları çıkar
ANY_LEGIT=$(echo "$CONTENT" | grep -B1 ': any\b\|\bas any\b' | grep -c 'eslint-disable' || true)
REAL_ANY=$((ANY_COUNT - ANY_LEGIT))
if [ "$REAL_ANY" -gt 0 ]; then
  WARNINGS="${WARNINGS}⚠️  'any' type tespit edildi ($REAL_ANY yer) — explicit type veya 'unknown' + type guard kullan.
"
  log_pattern "any-type"
fi

# ─── 2. console.log (logger yerine) ───────────────────────────────────
# Production code'da console.log/debug/info yasak
CONSOLE_COUNT=$(echo "$CONTENT" | grep -c 'console\.\(log\|debug\|info\|warn\|error\)' || true)
CONSOLE_LEGIT=$(echo "$CONTENT" | grep -B1 'console\.\(log\|debug\|info\)' | grep -c 'eslint-disable\|// debug' || true)
REAL_CONSOLE=$((CONSOLE_COUNT - CONSOLE_LEGIT))
if [ "$REAL_CONSOLE" -gt 0 ]; then
  WARNINGS="${WARNINGS}⚠️  console.* kullanımı ($REAL_CONSOLE yer) — NestJS Logger'ı inject et (private logger = new Logger(ClassName.name)).
"
  log_pattern "console-log"
fi

# ─── 3. await eksik (async fonksiyonda Promise dönen call) ────────────
# Basit heuristic: "function X(...) {" veya "async X(..." içinde ".find(" gibi promise döndüren metod çağrısı var ama await yok
# Bu pattern false positive verebilir — sadece açık durumları yakalayalım
MISSING_AWAIT=$(echo "$CONTENT" | grep -E '^\s*(this\.\w+Model|this\.repo)\.(find|findOne|save|update|delete|create)\(' | grep -v 'await' | grep -v 'return' || true)
if [ -n "$MISSING_AWAIT" ]; then
  WARNINGS="${WARNINGS}⚠️  Mongoose/TypeORM metod çağrısı await'siz görünüyor. Promise'i bekle veya return et.
"
  log_pattern "missing-await"
fi

# ─── 4. Hardcoded secret (basit check) ────────────────────────────────
SECRET_PATTERNS='password\s*=\s*[\"''][^\"'']\{8,\}[\"'']\|api.?key\s*=\s*[\"''][^\"'']\{16,\}[\"'']\|secret\s*=\s*[\"''][^\"'']\{16,\}[\"'']\|jwt.?secret\s*=\s*[\"''][^\"'']\{8,\}[\"'']'
HARDCODED=$(echo "$CONTENT" | grep -iE "$SECRET_PATTERNS" | grep -v 'process\.env' | grep -v 'example' || true)
if [ -n "$HARDCODED" ]; then
  WARNINGS="${WARNINGS}🔴 CRITICAL: Hardcoded secret şüphesi — process.env kullan, .env.example'a key ekle.
"
  log_pattern "hardcoded-secret"
fi

# ─── 5. Select: false eksik (password/token schema) ──────────────────
case "$FILE" in
  *.schema.ts)
    # Schema'da password/token field'ı var ama select:false yok
    PASS_WITHOUT_SELECT=$(echo "$CONTENT" | grep -B2 -A2 "password\|refreshToken\|accessToken" | grep -v "select.*false" | grep -E "@Prop\(\)|@Prop\({" || true)
    if echo "$CONTENT" | grep -qE '(password|refreshToken|accessToken).*String' && ! echo "$CONTENT" | grep -q 'select:\s*false'; then
      WARNINGS="${WARNINGS}🔴 CRITICAL: Schema'da hassas field (password/token) var ama select:false yok. Response'ta leak etmesin!
"
      log_pattern "missing-select-false"
    fi
    ;;
esac

# ─── 6. DTO'da class-validator yok ───────────────────────────────────
case "$FILE" in
  *.dto.ts)
    # DTO class'ında field var ama hiç decorator yok
    if echo "$CONTENT" | grep -q "^export class "; then
      HAS_FIELDS=$(echo "$CONTENT" | grep -c ": string\|: number\|: boolean\|: Date" || true)
      HAS_DECORATORS=$(echo "$CONTENT" | grep -c "@Is\|@Min\|@Max\|@Length\|@Allow" || true)
      if [ "$HAS_FIELDS" -gt 0 ] && [ "$HAS_DECORATORS" -eq 0 ]; then
        WARNINGS="${WARNINGS}🔴 CRITICAL: DTO'da class-validator decorator yok. Input validation bypass edilir!
"
        log_pattern "dto-no-validator"
      fi
    fi
    ;;
esac

# ─── 7. Controller'da @UseGuards yok + public keyword yok ────────────
case "$FILE" in
  *.controller.ts)
    # Public decorator yoksa guard olmalı
    if ! echo "$CONTENT" | grep -q "@Public()\|@UseGuards\|@SkipAuth"; then
      WARNINGS="${WARNINGS}⚠️  Controller'da @UseGuards veya @Public() yok. Endpoint korumasız mı?
"
      log_pattern "controller-no-guard"
    fi
    ;;
esac

# ─── 8. @Throttle eksik (rate limit) ──────────────────────────────────
case "$FILE" in
  *.controller.ts)
    # POST/PUT/PATCH var ama throttle yok
    if echo "$CONTENT" | grep -qE "@(Post|Put|Patch|Delete)\(" && ! echo "$CONTENT" | grep -q "@Throttle\|@SkipThrottle"; then
      WARNINGS="${WARNINGS}⚠️  Mutating endpoint (POST/PUT/PATCH) var ama @Throttle yok. Rate limit ekle.
"
      log_pattern "no-throttle"
    fi
    ;;
esac

# ─── 9. Mongoose injection riski ($where, $regex) ────────────────────
INJECTION=$(echo "$CONTENT" | grep -E '\\$where\|{\s*\\$regex:' || true)
if [ -n "$INJECTION" ]; then
  WARNINGS="${WARNINGS}🔴 CRITICAL: \$where veya \$regex user input ile birlikte görünüyor — NoSQL injection riski.
"
  log_pattern "nosql-injection"
fi

# ─── 10. Uzun fonksiyon (>50 satır) ──────────────────────────────────
# Basit yaklaşım: class metodları arasındaki satır sayısı
LONG_FUNCS=$(awk '
  /^\s*(async\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*[:{]/ {
    if (in_func && line_count > 50) print line_count " satırlık fonksiyon";
    in_func = 1; line_count = 0; next
  }
  in_func { line_count++ }
' "$FILE" 2>/dev/null || true)
if [ -n "$LONG_FUNCS" ]; then
  COUNT_LONG=$(echo "$LONG_FUNCS" | wc -l | tr -d ' ')
  WARNINGS="${WARNINGS}ℹ️  $COUNT_LONG fonksiyon 50+ satır — split'i düşün (Single Responsibility).
"
  log_pattern "long-function"
fi

# ─── Çıktı ────────────────────────────────────────────────────────────
if [ -n "$WARNINGS" ]; then
  echo "=== $FILE ==="
  printf "%s" "$WARNINGS"
fi

exit 0
