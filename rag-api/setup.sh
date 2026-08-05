#!/usr/bin/env bash
set -euo pipefail

# Required: export PROJECT_ID=your-gcp-project-id
PROJECT_ID="${PROJECT_ID:?export PROJECT_ID=your-gcp-project-id}"
REGION="${REGION:-us-central1}"
INSTANCE_NAME="${INSTANCE_NAME:-equiptalk-pg}"
DB_NAME="${DB_NAME:-equiptalk}"
DB_USER="${DB_USER:-equiptalk_user}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)}"

echo "==> Enabling GCP APIs..."
gcloud services enable \
  sqladmin.googleapis.com \
  compute.googleapis.com \
  aiplatform.googleapis.com \
  servicenetworking.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project "$PROJECT_ID"

echo "==> Creating Cloud SQL instance (Postgres 15, ~5 min)..."
gcloud sql instances create "$INSTANCE_NAME" \
  --database-version=POSTGRES_15 \
  --tier=db-g1-small \
  --region="$REGION" \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --project "$PROJECT_ID"

echo "==> Creating database and user..."
gcloud sql databases create "$DB_NAME" \
  --instance="$INSTANCE_NAME" \
  --project "$PROJECT_ID"

gcloud sql users create "$DB_USER" \
  --instance="$INSTANCE_NAME" \
  --password="$DB_PASSWORD" \
  --project "$PROJECT_ID"

INSTANCE_CONNECTION_NAME="$PROJECT_ID:$REGION:$INSTANCE_NAME"

echo "==> Applying schema..."
echo "    (If this step fails, run manually: gcloud sql connect $INSTANCE_NAME --user=$DB_USER --database=$DB_NAME < schema.sql)"
gcloud sql connect "$INSTANCE_NAME" \
  --user="$DB_USER" \
  --database="$DB_NAME" \
  --project "$PROJECT_ID" < schema.sql || echo "Schema apply skipped — run manually."

echo "==> Writing .env..."
cat > .env <<EOF
PROJECT_ID=$PROJECT_ID
REGION=$REGION
CLOUD_SQL_INSTANCE=$INSTANCE_CONNECTION_NAME
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
ANTHROPIC_API_KEY=sk-ant-REPLACE_ME
EOF

echo ""
echo "Done!"
echo "  Instance: $INSTANCE_CONNECTION_NAME"
echo "  DB user:  $DB_USER"
echo "  Next: edit ANTHROPIC_API_KEY in .env, then run:"
echo "    pip install -r requirements.txt"
echo "    gcloud auth application-default login"
echo "    python ingest.py path/to/manual.pdf source-name"
echo "    uvicorn main:app --reload"
