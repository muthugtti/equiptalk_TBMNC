# Google Cloud Platform & Firebase Setup Guide

Since you are using **Prisma (PostgreSQL)** and **Next.js SSR**, we need to set up a few things in Google Cloud Platform (GCP) manually because they cannot be fully automated by code files alone.

## 1. Prerequisites
- Ensure you have the [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed.
- Ensure you have [Firebase CLI](https://firebase.google.com/docs/cli) installed (`npm install -g firebase-tools`).
- Login:
  ```bash
  gcloud auth login
  firebase login
  ```

## 2. Infrastructure Setup (One-time)

### A. Enable APIs
Enable the necessary Google Cloud APIs for your project:
```bash
# Replace YOUR_PROJECT_ID with your actual Firebase project ID
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  compute.googleapis.com \
  storage.googleapis.com \
  --project=YOUR_PROJECT_ID
```

### B. Create Cloud SQL Instance (PostgreSQL)
Since the app uses Prisma with Postgres, you need a database.
1. Go to [Cloud SQL Instances](https://console.cloud.google.com/sql/instances).
2. Create a **PostgreSQL** instance.
3. Choose **Enterprise Plus** or **Sandox** (dev) based on budget.
   - *Tip*: For a cheap dev environment, choose "Sandbox" (Shared core) -> "Micro".
4. Create a user and password.
   - Database User: `equiptalk-user`
   - Password: `YOUR_SECURE_PASSWORD`
5. Create a database named `equiptalk-db`.

### C. Configure Environment Variables (Secrets)
We will use **Secret Manager** to store the database URL securely, so it doesn't get exposed.

1. Create the `DATABASE_URL` secret:
   ```bash
   # Format: postgresql://USER:PASSWORD@HOST:5432/DATABASE
   # For Cloud Run, HOST is usually a socket path, but for now let's store the connection string.
   # Recommended for Cloud Run: /cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
   
   echo -n "postgresql://equiptalk-user:YOUR_SECURE_PASSWORD@localhost/equiptalk-db?host=/cloudsql/YOUR_PROJECT_ID:REGION:INSTANCE_NAME" | \
   gcloud secrets create DATABASE_URL --data-file=- --project=YOUR_PROJECT_ID
   ```
   *Note: On your local machine, use `localhost` and run the Cloud SQL Proxy.*

2. Grant the Compute Engine default service account access to this secret:
   ```bash
   # Find your project number
   PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")
   
   gcloud secrets add-iam-policy-binding DATABASE_URL \
     --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor" \
     --project=YOUR_PROJECT_ID
   ```

### D. Create Storage Bucket
Create a standard GCS bucket for document uploads:
```bash
gcloud storage buckets create gs://equiptalk-uploads-YOUR_PROJECT_ID --project=YOUR_PROJECT_ID --location=us-central1
```
Configure CORS if you upload directly from the browser (optional, but good practice):
```bash
# Create correct cors-json file
echo '[{"origin": ["*"],"method": ["GET", "POST", "PUT", "DELETE"],"responseHeader": ["Content-Type"],"maxAgeSeconds": 3600}]' > cors.json

gcloud storage buckets update gs://equiptalk-uploads-YOUR_PROJECT_ID --cors-file=cors.json
rm cors.json
```

## 3. Deploy
When you run `firebase deploy`, Firebase will detect Next.js and spin up a Cloud Run service (Gen 2).

You might need to update `next.config.ts` or `firebase.json` if the automatic detection fails, but usually, it works out of the box with `firebase-tools` v13+.

```bash
firebase deploy --only hosting
```
