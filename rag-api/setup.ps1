# Equiptalk RAG — GCP setup script
# Run from the equiptalk-rag-api folder:
#   cd "C:\Users\masst\Claude\Projects\Equiptalk AI\equiptalk_TBMNC\rag-api"
#   .\setup.ps1

$PROJECT_ID    = "equiptalk-317d8"
$REGION        = "us-central1"
$INSTANCE_NAME = "equiptalk-pg"
$DB_NAME       = "equiptalk"
$DB_USER       = "equiptalk_user"
$DB_PASSWORD   = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })

Write-Host "==> Enabling GCP APIs..." -ForegroundColor Cyan
gcloud services enable `
  sqladmin.googleapis.com `
  compute.googleapis.com `
  aiplatform.googleapis.com `
  servicenetworking.googleapis.com `
  cloudresourcemanager.googleapis.com `
  --project $PROJECT_ID

Write-Host "==> Creating Cloud SQL instance (Postgres 15, ~5-8 min)..." -ForegroundColor Cyan
gcloud sql instances create $INSTANCE_NAME `
  --database-version=POSTGRES_15 `
  --tier=db-g1-small `
  --region=$REGION `
  --storage-type=SSD `
  --storage-size=20GB `
  --storage-auto-increase `
  --project $PROJECT_ID

Write-Host "==> Creating database..." -ForegroundColor Cyan
gcloud sql databases create $DB_NAME --instance=$INSTANCE_NAME --project $PROJECT_ID

Write-Host "==> Creating user..." -ForegroundColor Cyan
gcloud sql users create $DB_USER --instance=$INSTANCE_NAME --password=$DB_PASSWORD --project $PROJECT_ID

$INSTANCE_CONNECTION_NAME = "$PROJECT_ID`:$REGION`:$INSTANCE_NAME"

Write-Host "==> Writing .env..." -ForegroundColor Cyan
@"
PROJECT_ID=$PROJECT_ID
REGION=$REGION
CLOUD_SQL_INSTANCE=$INSTANCE_CONNECTION_NAME
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
ANTHROPIC_API_KEY=sk-ant-REPLACE_ME
"@ | Out-File -FilePath ".env" -Encoding utf8

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host "  Instance: $INSTANCE_CONNECTION_NAME"
Write-Host "  DB user:  $DB_USER"
Write-Host "  DB pass:  $DB_PASSWORD  <-- save this!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Edit ANTHROPIC_API_KEY in .env"
Write-Host "  2. Apply schema manually (see below)"
Write-Host ""
Write-Host "To apply schema, run:" -ForegroundColor Yellow
Write-Host "  gcloud sql connect $INSTANCE_NAME --user=$DB_USER --database=$DB_NAME < schema.sql"
