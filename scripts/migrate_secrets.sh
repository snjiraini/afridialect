#!/usr/bin/env bash
# =============================================================================
# migrate_secrets.sh — Upload .env.local to AWS Secrets Manager
#
# Usage:
#   chmod +x scripts/migrate_secrets.sh
#   ./scripts/migrate_secrets.sh [--secret-name NAME] [--profile PROFILE] \
#                                [--region REGION] [--dry-run]
#
# Requirements:
#   - aws CLI v2  (https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
#   - python3     (pre-installed on all major systems)
#   - A .env.local file in the project root
#
# What it does:
#   1. Reads .env.local, strips comments and blank lines
#   2. Converts to a flat JSON object  { "KEY": "value", ... }
#   3. Creates (or updates) the secret in AWS Secrets Manager
#   4. Skips keys listed in SKIP_KEYS (NEXT_PUBLIC_* are public — no point
#      storing them in Secrets Manager)
# =============================================================================

set -euo pipefail

# --------------------------------------------------------------------------- #
# Defaults (override via CLI flags)                                             #
# --------------------------------------------------------------------------- #
SECRET_NAME="${AWS_SECRET_ID:-afridialect/production/env}"
AWS_PROFILE_ARG=""
AWS_REGION_ARG="${AWS_REGION:-us-east-1}"
DRY_RUN=false
ENV_FILE=".env.local"

# Keys to exclude — browser-public vars don't belong in Secrets Manager
SKIP_KEYS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  "NEXT_PUBLIC_APP_URL"
  "NEXT_PUBLIC_GA_MEASUREMENT_ID"
  "NEXT_PUBLIC_PINATA_GATEWAY"
  "NEXT_PUBLIC_POSTHOG_HOST"
  "NEXT_PUBLIC_POSTHOG_KEY"
  "NEXT_PUBLIC_SENTRY_DSN"
  "NODE_ENV"
)

# --------------------------------------------------------------------------- #
# Parse CLI flags                                                               #
# --------------------------------------------------------------------------- #
while [[ $# -gt 0 ]]; do
  case "$1" in
    --secret-name)  SECRET_NAME="$2"; shift 2 ;;
    --profile)      AWS_PROFILE_ARG="--profile $2"; shift 2 ;;
    --region)       AWS_REGION_ARG="$2"; shift 2 ;;
    --env-file)     ENV_FILE="$2"; shift 2 ;;
    --dry-run)      DRY_RUN=true; shift ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# --------------------------------------------------------------------------- #
# Checks                                                                        #
# --------------------------------------------------------------------------- #
for cmd in aws python3; do
  command -v "$cmd" &>/dev/null || { echo "❌  $cmd is required but not installed."; exit 1; }
done

[[ -f "$ENV_FILE" ]] || { echo "❌  $ENV_FILE not found. Run from project root."; exit 1; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Afridialect — AWS Secrets Manager Migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Source  : $ENV_FILE"
echo "  Secret  : $SECRET_NAME"
echo "  Region  : $AWS_REGION_ARG"
[[ "$DRY_RUN" == "true" ]] && echo "  Mode    : DRY RUN (no AWS calls)"
echo ""

# --------------------------------------------------------------------------- #
# Build JSON from .env.local                                                    #
# Uses Python3 for safe JSON serialisation of arbitrary values.                 #
# --------------------------------------------------------------------------- #
build_json() {
  # Pass the skip-list and env file path to Python; it prints the JSON to
  # stdout and the human-readable key log to stderr so the caller can capture
  # them independently.
  python3 - "$ENV_FILE" "${SKIP_KEYS[@]}" <<'PYEOF'
import sys, json, os

env_file = sys.argv[1]
skip_keys = set(sys.argv[2:])

result = {}
with open(env_file, 'r', encoding='utf-8') as fh:
    for raw in fh:
        line = raw.rstrip('\n')
        # Skip comments and blank lines
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        # Split on first '=' only
        if '=' not in line:
            continue
        key, _, val = line.partition('=')
        key = key.strip()
        if not key:
            continue
        if key in skip_keys:
            print(f'  ⏭  Skipping public key: {key}', file=sys.stderr)
            continue
        result[key] = val
        print(f'  ✅  Queued: {key}', file=sys.stderr)

print(json.dumps(result, ensure_ascii=False))
PYEOF
}

echo "📋  Reading $ENV_FILE…"
# build_json prints key-log lines to stderr (shown in terminal) and JSON to stdout.
SECRET_JSON="$(build_json)"
KEY_COUNT="$(echo "$SECRET_JSON" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))')"
echo ""
echo "  $KEY_COUNT secret(s) ready to upload."
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
  echo "🔍  Dry-run — secret JSON preview (values masked):"
  echo "$SECRET_JSON" | python3 -c '
import sys, json
d = json.load(sys.stdin)
masked = {k: "***" for k in d}
print(json.dumps(masked, indent=2))
'
  echo ""
  echo "✅  Dry run complete. No changes were made."
  exit 0
fi

# --------------------------------------------------------------------------- #
# Upload to AWS Secrets Manager (create or update)                              #
# --------------------------------------------------------------------------- #
AWS_CMD="aws secretsmanager $AWS_PROFILE_ARG --region $AWS_REGION_ARG"

echo "🚀  Uploading to AWS Secrets Manager…"

# Check if secret already exists
if $AWS_CMD describe-secret --secret-id "$SECRET_NAME" &>/dev/null; then
  echo "  ↻  Secret \"$SECRET_NAME\" exists — updating value…"
  $AWS_CMD put-secret-value \
    --secret-id "$SECRET_NAME" \
    --secret-string "$SECRET_JSON" \
    --output json | python3 -c 'import sys,json; d=json.load(sys.stdin); print(json.dumps({k:d[k] for k in ["ARN","Name","VersionId"] if k in d}, indent=2))'
  echo ""
  echo "✅  Secret updated successfully."
else
  echo "  ✨  Secret \"$SECRET_NAME\" not found — creating…"
  $AWS_CMD create-secret \
    --name "$SECRET_NAME" \
    --description "Afridialect.ai application secrets (migrated from .env.local)" \
    --secret-string "$SECRET_JSON" \
    --tags '[{"Key":"Project","Value":"Afridialect"},{"Key":"Environment","Value":"production"}]' \
    --output json | python3 -c 'import sys,json; d=json.load(sys.stdin); print(json.dumps({k:d[k] for k in ["ARN","Name","VersionId"] if k in d}, indent=2))'
  echo ""
  echo "✅  Secret created successfully."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Next steps:"
echo "  1. Set AWS_SECRET_ID=$SECRET_NAME in your deployment env"
echo "  2. Attach the IAM policy from docs/hedera-kms-policy.json"
echo "     (or use the secretsmanager-policy.json in this directory)"
echo "  3. Remove sensitive values from your CI/CD environment variables"
echo "     (they will now be pulled from Secrets Manager automatically)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
