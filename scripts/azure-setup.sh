#!/usr/bin/env zsh
# =============================================================================
# azure-setup.sh
# One-time Azure infrastructure provisioning for Afridialect.ai
#
# ⚠️  Run this ONCE on a fresh Azure subscription.
#     After this, all deploys are handled by GitHub Actions (deploy-azure.yml).
#
# What this script creates:
#   1. Resource Group          — afridialect-rg (eastus)
#   2. Container Registry      — afridialectacr.azurecr.io (Basic SKU)
#   3. Initial Docker image    — built via ACR Tasks (no local Docker needed)
#   4. Container Apps env      — afridialect-env
#   5. Container App           — afridialect-app (0–3 replicas, scale-to-zero)
#   6. Azure secrets           — 3 AWS bootstrap credentials only
#   7. Runtime env vars        — wired to secrets + plain public vars
#
# Secret strategy (matches live deployment):
#   Azure holds ONLY 3 secrets needed to bootstrap AWS SDK:
#     - aws-access-key-id
#     - aws-secret-access-key
#     - aws-kms-key-id
#   All other secrets (Hedera, Supabase, Pinata, etc.) stay in
#   AWS Secrets Manager ("afridialect/production/env") and are fetched
#   at runtime by lib/secrets/index.ts. Nothing else touches Azure.
#
# Prerequisites:
#   - Azure CLI installed: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
#   - Logged in: az login
#   - .env.local present with NEXT_PUBLIC_* values
#   - AWS credentials available (to pass as secrets below)
#
# Usage:
#   chmod +x scripts/azure-setup.sh
#   AWS_ACCESS_KEY_ID=<key> AWS_SECRET_ACCESS_KEY=<secret> AWS_KMS_KEY_ID=<id> \
#     ./scripts/azure-setup.sh
# =============================================================================

set -euo pipefail

# ── Configuration (matches live Azure deployment) ─────────────────────────────
RESOURCE_GROUP="afridialect-rg"
LOCATION="eastus"
ACR_NAME="afridialectacr"
ACR_SERVER="${ACR_NAME}.azurecr.io"
CONTAINER_APP_ENV="afridialect-env"
CONTAINER_APP_NAME="afridialect-app"
IMAGE_NAME="afridialect"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; exit 1; }

# ── Preflight checks ──────────────────────────────────────────────────────────
info "Checking prerequisites..."
command -v az >/dev/null 2>&1 || error "Azure CLI not found. Install from https://aka.ms/install-azure-cli"
az account show >/dev/null 2>&1 || error "Not logged in to Azure. Run: az login"

[[ -z "${AWS_ACCESS_KEY_ID:-}" ]]     && error "AWS_ACCESS_KEY_ID is not set. Export it before running this script."
[[ -z "${AWS_SECRET_ACCESS_KEY:-}" ]] && error "AWS_SECRET_ACCESS_KEY is not set. Export it before running this script."
[[ -z "${AWS_KMS_KEY_ID:-}" ]]        && error "AWS_KMS_KEY_ID is not set. Export it before running this script."

success "Prerequisites OK."

# ── Load NEXT_PUBLIC_* from .env.local ────────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env.local not found — NEXT_PUBLIC_* build args will be empty."
  NEXT_PUBLIC_APP_URL=""
  NEXT_PUBLIC_SUPABASE_URL=""
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
  NEXT_PUBLIC_PINATA_GATEWAY=""
else
  set -a
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ENV_FILE" | grep 'NEXT_PUBLIC_' | xargs)
  set +a
  success "Loaded NEXT_PUBLIC_* from .env.local"
fi

# ── 1. Resource Group ─────────────────────────────────────────────────────────
info "Creating resource group: $RESOURCE_GROUP ($LOCATION)..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none
success "Resource group ready."

# ── 2. Azure Container Registry (Basic SKU — ~$5/month) ──────────────────────
info "Creating Azure Container Registry: $ACR_NAME..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output none
success "ACR ready: ${ACR_SERVER}"

# ── 3. Build & push initial image via ACR Tasks (runs in Azure) ───────────────
info "Building and pushing initial Docker image via ACR Tasks..."
az acr build \
  --registry "$ACR_NAME" \
  --image "${IMAGE_NAME}:latest" \
  --build-arg "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" \
  --build-arg "NEXT_PUBLIC_PINATA_GATEWAY=${NEXT_PUBLIC_PINATA_GATEWAY:-}" \
  .
success "Image pushed: ${ACR_SERVER}/${IMAGE_NAME}:latest"

# ── 4. Container Apps Environment ─────────────────────────────────────────────
info "Creating Container Apps environment: $CONTAINER_APP_ENV..."
az containerapp env create \
  --name "$CONTAINER_APP_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none
success "Container Apps environment ready."

# ── 5. Retrieve ACR admin credentials ─────────────────────────────────────────
info "Fetching ACR credentials..."
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query "username" -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

# ── 6. Create Container App ───────────────────────────────────────────────────
# Initial deploy without secrets — secrets are added in step 7.
info "Creating Container App: $CONTAINER_APP_NAME..."
az containerapp create \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$CONTAINER_APP_ENV" \
  --image "${ACR_SERVER}/${IMAGE_NAME}:latest" \
  --registry-server "$ACR_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    NODE_ENV=production \
    "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-}" \
    "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-}" \
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" \
    "NEXT_PUBLIC_PINATA_GATEWAY=${NEXT_PUBLIC_PINATA_GATEWAY:-}" \
  --output none
success "Container App created."

# ── 7. Get the live FQDN ──────────────────────────────────────────────────────
APP_FQDN=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv)

# ── 8. Register AWS bootstrap secrets (the only 3 secrets Azure holds) ────────
info "Setting AWS bootstrap secrets on Container App..."
az containerapp secret set \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --secrets \
    "aws-access-key-id=${AWS_ACCESS_KEY_ID}" \
    "aws-secret-access-key=${AWS_SECRET_ACCESS_KEY}" \
    "aws-kms-key-id=${AWS_KMS_KEY_ID}" \
  --output none
success "Secrets registered."

# ── 9. Wire secrets + remaining env vars into the app ─────────────────────────
info "Updating env vars (including secret refs and corrected APP_URL)..."
az containerapp update \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars \
    NODE_ENV=production \
    "NEXT_PUBLIC_APP_URL=https://${APP_FQDN}" \
    "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-}" \
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" \
    "NEXT_PUBLIC_PINATA_GATEWAY=${NEXT_PUBLIC_PINATA_GATEWAY:-}" \
    AWS_REGION=us-east-1 \
    AWS_SECRET_ID=afridialect/production/env \
    AWS_ACCESS_KEY_ID=secretref:aws-access-key-id \
    AWS_SECRET_ACCESS_KEY=secretref:aws-secret-access-key \
    AWS_KMS_KEY_ID=secretref:aws-kms-key-id \
  --output none
success "Env vars updated."

# ── 10. Print live URL ────────────────────────────────────────────────────────
echo ""
success "═══════════════════════════════════════════════════"
success " Afridialect.ai is live at:"
success " https://${APP_FQDN}"
success "═══════════════════════════════════════════════════"
echo ""

# ── 11. GitHub Actions setup instructions ────────────────────────────────────
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
info "Next step — create the AZURE_CREDENTIALS GitHub secret:"
echo ""
echo "  az ad sp create-for-rbac \\"
echo "    --name afridialect-github-actions \\"
echo "    --role contributor \\"
echo "    --scopes /subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP} \\"
echo "    --sdk-auth"
echo ""
info "Then add these secrets to GitHub (Settings → Secrets → Actions):"
echo ""
echo "  AZURE_CREDENTIALS                 → JSON output from the command above"
echo "  NEXT_PUBLIC_SUPABASE_URL          → ${NEXT_PUBLIC_SUPABASE_URL:-<value>}"
echo "  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY → ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-<value>}"
echo "  NEXT_PUBLIC_PINATA_GATEWAY        → ${NEXT_PUBLIC_PINATA_GATEWAY:-<value>}"
echo "  NEXT_PUBLIC_SENTRY_DSN            → (optional)"
echo "  NEXT_PUBLIC_GA_MEASUREMENT_ID     → (optional)"
echo "  NEXT_PUBLIC_POSTHOG_KEY           → (optional)"
echo "  NEXT_PUBLIC_POSTHOG_HOST          → (optional)"
echo ""
info "All other secrets remain in AWS Secrets Manager — nothing else needed here."


set -euo pipefail

# ── Configuration (edit these if needed) ──────────────────────────────────────
RESOURCE_GROUP="afridialect-rg"
LOCATION="eastus"
ACR_NAME="afridialectacr"          # Globally unique, lowercase, no hyphens
CONTAINER_APP_ENV="afridialect-env"
CONTAINER_APP_NAME="afridialect-app"
IMAGE_NAME="afridialect"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; exit 1; }

# ── Preflight checks ──────────────────────────────────────────────────────────
info "Checking prerequisites..."
command -v az >/dev/null 2>&1 || error "Azure CLI not found. Install from https://aka.ms/install-azure-cli"
az account show >/dev/null 2>&1 || error "Not logged in to Azure. Run: az login"
success "Azure CLI ready."

# ── Load env file for NEXT_PUBLIC_* values ────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env.local not found — NEXT_PUBLIC_* build args will be empty."
  NEXT_PUBLIC_APP_URL=""
  NEXT_PUBLIC_SUPABASE_URL=""
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
  NEXT_PUBLIC_PINATA_GATEWAY=""
else
  export $(grep -v '^#' "$ENV_FILE" | grep 'NEXT_PUBLIC_' | xargs)
  success "Loaded NEXT_PUBLIC_* from .env.local"
fi

# ── 1. Resource Group ─────────────────────────────────────────────────────────
info "Creating resource group: $RESOURCE_GROUP ($LOCATION)..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none
success "Resource group ready."

# ── 2. Azure Container Registry (Basic — cheapest tier ~$5/mo) ───────────────
info "Creating Azure Container Registry: $ACR_NAME..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output none
success "ACR ready: ${ACR_NAME}.azurecr.io"

# ── 3. Build & push the initial image via ACR Tasks (no local Docker needed) ──
info "Building and pushing initial Docker image via ACR Tasks..."
az acr build \
  --registry "$ACR_NAME" \
  --image "${IMAGE_NAME}:latest" \
  --build-arg "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" \
  --build-arg "NEXT_PUBLIC_PINATA_GATEWAY=${NEXT_PUBLIC_PINATA_GATEWAY:-}" \
  .
success "Image pushed: ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest"

# ── 4. Container Apps Environment ─────────────────────────────────────────────
info "Creating Container Apps environment: $CONTAINER_APP_ENV..."
az containerapp env create \
  --name "$CONTAINER_APP_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none
success "Container Apps environment ready."

# ── 5. Retrieve ACR credentials for Container Apps ───────────────────────────
info "Fetching ACR credentials..."
ACR_SERVER="${ACR_NAME}.azurecr.io"
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query "username" -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

# ── 6. Deploy Container App ───────────────────────────────────────────────────
info "Creating Container App: $CONTAINER_APP_NAME..."
az containerapp create \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$CONTAINER_APP_ENV" \
  --image "${ACR_SERVER}/${IMAGE_NAME}:latest" \
  --registry-server "$ACR_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --target-port 3000 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    NODE_ENV=production \
    "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-}" \
    "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-}" \
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" \
    "NEXT_PUBLIC_PINATA_GATEWAY=${NEXT_PUBLIC_PINATA_GATEWAY:-}" \
  --output none
success "Container App deployed."

# ── 7. Add secrets (runtime server-side only — never baked into image) ────────
info "Registering Container App secrets..."
warn "You must now set the following secrets manually via the Azure Portal"
warn "or by running the commands below (replace <value> with real values):"
echo ""
echo "  az containerapp secret set \\"
echo "    --name $CONTAINER_APP_NAME \\"
echo "    --resource-group $RESOURCE_GROUP \\"
echo "    --secrets \\"
echo "      supabase-service-role-key=<SUPABASE_SERVICE_ROLE_KEY> \\"
echo "      aws-access-key-id=<AWS_ACCESS_KEY_ID> \\"
echo "      aws-secret-access-key=<AWS_SECRET_ACCESS_KEY> \\"
echo "      aws-kms-key-id=<AWS_KMS_KEY_ID> \\"
echo "      hedera-treasury-account-id=<HEDERA_TREASURY_ACCOUNT_ID> \\"
echo "      hedera-treasury-private-key=<HEDERA_TREASURY_PRIVATE_KEY> \\"
echo "      pinata-jwt=<PINATA_JWT>"
echo ""
echo "  Then update the app to reference them as secret env vars:"
echo ""
echo "  az containerapp update \\"
echo "    --name $CONTAINER_APP_NAME \\"
echo "    --resource-group $RESOURCE_GROUP \\"
echo "    --set-env-vars \\"
echo "      SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role-key \\"
echo "      AWS_ACCESS_KEY_ID=secretref:aws-access-key-id \\"
echo "      AWS_SECRET_ACCESS_KEY=secretref:aws-secret-access-key \\"
echo "      AWS_KMS_KEY_ID=secretref:aws-kms-key-id \\"
echo "      HEDERA_NETWORK=testnet \\"
echo "      HEDERA_TREASURY_ACCOUNT_ID=secretref:hedera-treasury-account-id \\"
echo "      HEDERA_TREASURY_PRIVATE_KEY=secretref:hedera-treasury-private-key \\"
echo "      AWS_REGION=us-east-1 \\"
echo "      PINATA_JWT=secretref:pinata-jwt"
echo ""

# ── 8. Output the live URL ─────────────────────────────────────────────────────
APP_URL=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv)

echo ""
success "═══════════════════════════════════════════════════"
success " Afridialect.ai is live at:"
success " https://${APP_URL}"
success "═══════════════════════════════════════════════════"
echo ""

# ── 9. Print GitHub Actions secret values ────────────────────────────────────
info "Set these as GitHub repository secrets (Settings → Secrets → Actions):"
echo ""
echo "  AZURE_CREDENTIALS       → output of: az ad sp create-for-rbac ..."
echo "  NEXT_PUBLIC_APP_URL     → https://${APP_URL}"
echo "  NEXT_PUBLIC_SUPABASE_URL"
echo "  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
echo "  NEXT_PUBLIC_PINATA_GATEWAY"
echo ""
info "To create the AZURE_CREDENTIALS secret, run:"
echo ""
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "  az ad sp create-for-rbac \\"
echo "    --name afridialect-github-actions \\"
echo "    --role contributor \\"
echo "    --scopes /subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP} \\"
echo "    --sdk-auth"
echo ""
info "Copy the full JSON output and paste it as the AZURE_CREDENTIALS secret."
