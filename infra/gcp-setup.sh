#!/usr/bin/env bash
# =============================================================================
# Donovan Legal PLLC — GCP Project Setup
# =============================================================================
# Run this script ONCE from your local terminal to provision all GCP
# infrastructure needed for the Donovan Law site.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Billing account linked (the script will prompt you)
#   - Owner/Editor role on the billing account
#
# Usage:
#   chmod +x infra/gcp-setup.sh
#   ./infra/gcp-setup.sh
# =============================================================================

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
PROJECT_ID="donovan-law-site"
PROJECT_NAME="Donovan Legal PLLC"
REGION="us-east1"
SERVICE_NAME="donovan-law-site"
REPO_NAME="donovan-law"
GITHUB_OWNER="ConnexUS-AI"
GITHUB_REPO="donovan-law-site"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Donovan Legal PLLC — GCP Infrastructure Setup"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ─── Step 1: Create GCP Project ─────────────────────────────────────────────
echo "── Step 1: Create GCP Project ──────────────────────────────────"

if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
  warn "Project '$PROJECT_ID' already exists. Skipping creation."
else
  gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME"
  log "Project '$PROJECT_ID' created."
fi

gcloud config set project "$PROJECT_ID"
log "Active project set to '$PROJECT_ID'."

# ─── Step 2: Link Billing Account ───────────────────────────────────────────
echo ""
echo "── Step 2: Link Billing Account ────────────────────────────────"

BILLING_ACCOUNTS=$(gcloud billing accounts list --format='value(name)' 2>/dev/null)
BILLING_COUNT=$(echo "$BILLING_ACCOUNTS" | wc -l)

if [ "$BILLING_COUNT" -eq 1 ] && [ -n "$BILLING_ACCOUNTS" ]; then
  BILLING_ACCOUNT="$BILLING_ACCOUNTS"
  log "Found billing account: $BILLING_ACCOUNT"
else
  echo ""
  echo "Available billing accounts:"
  gcloud billing accounts list
  echo ""
  read -p "Enter the billing account ID to link: " BILLING_ACCOUNT
fi

CURRENT_BILLING=$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingAccountName)' 2>/dev/null || true)
if [ -n "$CURRENT_BILLING" ]; then
  warn "Billing already linked. Skipping."
else
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
  log "Billing account linked."
fi

# ─── Step 3: Enable APIs ────────────────────────────────────────────────────
echo ""
echo "── Step 3: Enable Required APIs ────────────────────────────────"

APIS=(
  "cloudbuild.googleapis.com"
  "run.googleapis.com"
  "artifactregistry.googleapis.com"
  "compute.googleapis.com"
  "iam.googleapis.com"
)

for api in "${APIS[@]}"; do
  echo -n "  Enabling $api... "
  gcloud services enable "$api" --quiet
  echo "done"
done
log "All APIs enabled."

# ─── Step 4: Create Artifact Registry Repository ────────────────────────────
echo ""
echo "── Step 4: Create Artifact Registry ─────────────────────────────"

if gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" &>/dev/null; then
  warn "Artifact Registry repo '$REPO_NAME' already exists. Skipping."
else
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Donovan Law Site container images"
  log "Artifact Registry repo '$REPO_NAME' created in $REGION."
fi

# ─── Step 5: Configure IAM for Cloud Build ───────────────────────────────────
echo ""
echo "── Step 5: Configure IAM Permissions ────────────────────────────"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "  Cloud Build service account: $CB_SA"

# Grant Cloud Run Admin
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin" \
  --condition=None \
  --quiet 2>/dev/null
log "Granted roles/run.admin to Cloud Build SA."

# Grant Service Account User (needed to deploy to Cloud Run)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None \
  --quiet 2>/dev/null
log "Granted roles/iam.serviceAccountUser to Cloud Build SA."

# Grant Artifact Registry Writer
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/artifactregistry.writer" \
  --condition=None \
  --quiet 2>/dev/null
log "Granted roles/artifactregistry.writer to Cloud Build SA."

# ─── Step 6: Create Cloud Build Trigger ──────────────────────────────────────
echo ""
echo "── Step 6: Create Cloud Build Trigger ───────────────────────────"

EXISTING_TRIGGER=$(gcloud builds triggers list --region="global" --format='value(name)' --filter="name=donovan-law-deploy" 2>/dev/null || true)

if [ -n "$EXISTING_TRIGGER" ]; then
  warn "Build trigger 'donovan-law-deploy' already exists. Skipping."
else
  echo ""
  warn "Cloud Build needs to be connected to your GitHub repo."
  echo "  If you haven't connected GitHub to Cloud Build yet, run:"
  echo ""
  echo "    gcloud builds triggers create github \\"
  echo "      --name='donovan-law-deploy' \\"
  echo "      --repo-owner='${GITHUB_OWNER}' \\"
  echo "      --repo-name='${GITHUB_REPO}' \\"
  echo "      --branch-pattern='^main$' \\"
  echo "      --build-config='cloudbuild.yaml' \\"
  echo "      --region='global'"
  echo ""
  read -p "  Attempt to create trigger now? (y/n): " CREATE_TRIGGER

  if [ "$CREATE_TRIGGER" = "y" ] || [ "$CREATE_TRIGGER" = "Y" ]; then
    gcloud builds triggers create github \
      --name="donovan-law-deploy" \
      --repo-owner="${GITHUB_OWNER}" \
      --repo-name="${GITHUB_REPO}" \
      --branch-pattern="^main$" \
      --build-config="cloudbuild.yaml" \
      --region="global" 2>&1 || warn "Trigger creation failed. You may need to connect GitHub first via the Cloud Console."
  else
    warn "Skipped trigger creation. Create it manually when ready."
  fi
fi

# ─── Step 7: Initial Deploy ─────────────────────────────────────────────────
echo ""
echo "── Step 7: Initial Deploy ───────────────────────────────────────"
echo ""
read -p "  Run the initial deploy now? (y/n): " DO_DEPLOY

if [ "$DO_DEPLOY" = "y" ] || [ "$DO_DEPLOY" = "Y" ]; then
  echo "  Submitting build to Cloud Build..."
  gcloud builds submit \
    --config=cloudbuild.yaml \
    --project="$PROJECT_ID" \
    --substitutions="_REGION=${REGION},_SERVICE_NAME=${SERVICE_NAME},_ARTIFACT_REGISTRY=${REGION}-docker.pkg.dev"
  
  SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)' 2>/dev/null || true)
  if [ -n "$SERVICE_URL" ]; then
    log "Deploy complete. Site is live at: $SERVICE_URL"
  fi
else
  warn "Skipped initial deploy. Run manually with:"
  echo "    gcloud builds submit --config=cloudbuild.yaml"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Setup Complete"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  Project:             $PROJECT_ID"
echo "  Region:              $REGION"
echo "  Service:             $SERVICE_NAME"
echo "  Artifact Registry:   ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"
echo "  Cloud Build Trigger: donovan-law-deploy (pushes to main)"
echo ""
echo "  Next steps:"
echo "    1. If trigger creation was skipped, connect GitHub via:"
echo "       https://console.cloud.google.com/cloud-build/triggers?project=${PROJECT_ID}"
echo "    2. To map the custom domain (donovan.law):"
echo "       gcloud run domain-mappings create \\"
echo "         --service=${SERVICE_NAME} \\"
echo "         --domain=donovan.law \\"
echo "         --region=${REGION}"
echo "    3. Update DNS A/AAAA records per the output above"
echo ""
echo "  Estimated monthly cost: ~\$0-5 (Cloud Run free tier covers most static sites)"
echo ""
