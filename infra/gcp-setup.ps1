# =============================================================================
# Donovan Legal PLLC — GCP Project Setup (PowerShell)
# =============================================================================
# Run this script ONCE from PowerShell to provision all GCP infrastructure.
#
# Prerequisites:
#   - gcloud CLI installed (https://cloud.google.com/sdk/docs/install)
#   - Authenticated: gcloud auth login
#
# Usage:
#   cd donovan-law-site
#   .\infra\gcp-setup.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# Helper: Run gcloud commands safely (gcloud writes status to stderr,
# which PowerShell treats as a terminating error with ErrorAction=Stop).
function Invoke-Gcloud {
    param([string]$Arguments)
    $proc = Start-Process -FilePath "gcloud" -ArgumentList $Arguments -NoNewWindow -Wait -PassThru -RedirectStandardError "$env:TEMP\gcloud_stderr.txt"
    return $proc.ExitCode
}

# ─── Configuration ───────────────────────────────────────────────────────────
$PROJECT_ID     = "donovan-law-site"
$PROJECT_NAME   = "Donovan Legal PLLC"
$REGION         = "us-east1"
$SERVICE_NAME   = "donovan-law-site"
$REPO_NAME      = "donovan-law"
$GITHUB_OWNER   = "ConnexUS-AI"
$GITHUB_REPO    = "donovan-law-site"

function Log($msg)  { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[XX] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Donovan Legal PLLC - GCP Infrastructure Setup" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ─── Step 1: Create GCP Project ─────────────────────────────────────────────
Write-Host "-- Step 1: Create GCP Project ----------------------------------" -ForegroundColor White

$projectExists = gcloud projects describe $PROJECT_ID 2>&1
if ($LASTEXITCODE -eq 0) {
    Warn "Project '$PROJECT_ID' already exists. Skipping creation."
} else {
    gcloud projects create $PROJECT_ID --name="$PROJECT_NAME"
    if ($LASTEXITCODE -ne 0) { Err "Failed to create project." }
    Log "Project '$PROJECT_ID' created."
}

gcloud config set project $PROJECT_ID
Log "Active project set to '$PROJECT_ID'."

# ─── Step 2: Link Billing Account ───────────────────────────────────────────
Write-Host ""
Write-Host "-- Step 2: Link Billing Account --------------------------------" -ForegroundColor White

$billingAccounts = (gcloud billing accounts list --format="value(name)" 2>&1) | Out-String
$billingAccounts = $billingAccounts.Trim()
$billingList = $billingAccounts -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '\S' }

if ($billingList.Count -eq 1) {
    $BILLING_ACCOUNT = [string]$billingList
    Log "Found billing account: $BILLING_ACCOUNT"
} elseif ($billingList.Count -gt 1) {
    Write-Host ""
    Write-Host "Available billing accounts:"
    gcloud billing accounts list
    Write-Host ""
    $BILLING_ACCOUNT = Read-Host "Enter the billing account ID to link"
} else {
    Write-Host ""
    Write-Host "Available billing accounts:"
    gcloud billing accounts list
    Write-Host ""
    $BILLING_ACCOUNT = Read-Host "Enter the billing account ID to link"
}

$currentBilling = gcloud billing projects describe $PROJECT_ID --format="value(billingAccountName)" 2>&1
if ($LASTEXITCODE -eq 0 -and $currentBilling -match '\S') {
    Warn "Billing already linked. Skipping."
} else {
    gcloud billing projects link $PROJECT_ID --billing-account="$BILLING_ACCOUNT"
    if ($LASTEXITCODE -ne 0) { Err "Failed to link billing account." }
    Log "Billing account linked."
}

# ─── Step 3: Enable APIs ────────────────────────────────────────────────────
Write-Host ""
Write-Host "-- Step 3: Enable Required APIs --------------------------------" -ForegroundColor White

$apis = @(
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com"
)

foreach ($api in $apis) {
    Write-Host "  Enabling $api... " -NoNewline
    $output = cmd /c "gcloud services enable $api --quiet 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAILED" -ForegroundColor Red
        Write-Host $output
        Err "Failed to enable $api"
    }
    Write-Host "done" -ForegroundColor Green
}
Log "All APIs enabled."

# ─── Step 4: Create Artifact Registry Repository ────────────────────────────
Write-Host ""
Write-Host "-- Step 4: Create Artifact Registry ----------------------------" -ForegroundColor White

$repoCheck = cmd /c "gcloud artifacts repositories describe $REPO_NAME --location=$REGION 2>&1"
if ($LASTEXITCODE -eq 0) {
    Warn "Artifact Registry repo '$REPO_NAME' already exists. Skipping."
} else {
    $createOut = cmd /c "gcloud artifacts repositories create $REPO_NAME --repository-format=docker --location=$REGION --description=`"Donovan Law Site container images`" 2>&1"
    if ($LASTEXITCODE -ne 0) { Err "Failed to create Artifact Registry repo: $createOut" }
    Log "Artifact Registry repo '$REPO_NAME' created in $REGION."
}

# ─── Step 5: Configure IAM for Cloud Build ───────────────────────────────────
Write-Host ""
Write-Host "-- Step 5: Configure IAM Permissions ---------------------------" -ForegroundColor White

$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$CB_SA = "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

Write-Host "  Cloud Build service account: $CB_SA"

$roles = @(
    "roles/run.admin",
    "roles/iam.serviceAccountUser",
    "roles/artifactregistry.writer"
)

foreach ($role in $roles) {
    $iamOut = cmd /c "gcloud projects add-iam-policy-binding $PROJECT_ID --member=serviceAccount:${CB_SA} --role=$role --condition=None --quiet 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Warn "Failed to grant $role - may need manual action."
    } else {
        Log "Granted $role to Cloud Build SA."
    }
}

# ─── Step 6: Create Cloud Build Trigger ──────────────────────────────────────
Write-Host ""
Write-Host "-- Step 6: Create Cloud Build Trigger --------------------------" -ForegroundColor White

$triggerCheck = cmd /c "gcloud builds triggers list --region=global --format=value(name) --filter=name=donovan-law-deploy 2>&1"
if ($LASTEXITCODE -eq 0 -and $triggerCheck -match "donovan-law-deploy") {
    Warn "Build trigger 'donovan-law-deploy' already exists. Skipping."
} else {
    Write-Host ""
    Warn "Cloud Build needs to be connected to your GitHub repo."
    Write-Host "  If you haven't connected GitHub to Cloud Build in this project yet,"
    Write-Host "  visit: https://console.cloud.google.com/cloud-build/triggers?project=${PROJECT_ID}"
    Write-Host ""

    $createTrigger = Read-Host "  Attempt to create trigger now? (y/n)"
    if ($createTrigger -eq "y" -or $createTrigger -eq "Y") {
        $triggerOut = cmd /c "gcloud builds triggers create github --name=donovan-law-deploy --repo-owner=$GITHUB_OWNER --repo-name=$GITHUB_REPO --branch-pattern=`"^main$`" --build-config=cloudbuild.yaml --region=global 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Warn "Trigger creation failed. Connect GitHub first via Cloud Console."
            Write-Host "  $triggerOut" -ForegroundColor DarkGray
        } else {
            Log "Build trigger created."
        }
    } else {
        Warn "Skipped trigger creation. Create it manually when ready."
    }
}

# ─── Step 7: Initial Deploy ─────────────────────────────────────────────────
Write-Host ""
Write-Host "-- Step 7: Initial Deploy --------------------------------------" -ForegroundColor White
Write-Host ""

$doDeploy = Read-Host "  Run the initial deploy now? (y/n)"
if ($doDeploy -eq "y" -or $doDeploy -eq "Y") {
    Write-Host "  Submitting build to Cloud Build (this may take a few minutes)..."
    cmd /c "gcloud builds submit --config=cloudbuild.yaml --project=$PROJECT_ID --substitutions=_REGION=${REGION},_SERVICE_NAME=${SERVICE_NAME},_ARTIFACT_REGISTRY=${REGION}-docker.pkg.dev,_TAG=latest 2>&1"

    $SERVICE_URL = cmd /c "gcloud run services describe $SERVICE_NAME --region=$REGION --format=value(status.url) 2>&1"
    if ($LASTEXITCODE -eq 0 -and $SERVICE_URL -match "https://") {
        Log "Deploy complete. Site is live at: $SERVICE_URL"
    }
} else {
    Warn "Skipped initial deploy. Run manually with:"
    Write-Host "    gcloud builds submit --config=cloudbuild.yaml"
}

# ─── Summary ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Setup Complete" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Project:             $PROJECT_ID"
Write-Host "  Region:              $REGION"
Write-Host "  Service:             $SERVICE_NAME"
Write-Host "  Artifact Registry:   ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"
Write-Host "  Cloud Build Trigger: donovan-law-deploy (pushes to main)"
Write-Host ""
Write-Host "  Next steps:"
Write-Host "    1. If trigger creation was skipped, connect GitHub via:"
Write-Host "       https://console.cloud.google.com/cloud-build/triggers?project=${PROJECT_ID}"
Write-Host "    2. To map the custom domain (donovan.law):"
Write-Host "       gcloud run domain-mappings create ``"
Write-Host "         --service=${SERVICE_NAME} ``"
Write-Host "         --domain=donovan.law ``"
Write-Host "         --region=${REGION}"
Write-Host "    3. Update DNS A/AAAA records per the output above"
Write-Host ""
Write-Host "  Estimated monthly cost: ~`$0-5 (Cloud Run free tier)" -ForegroundColor Green
Write-Host ""
