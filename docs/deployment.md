# Deployment Guide

Equiptalk AI is designed to be deployed to **Firebase Hosting**. We support both automated deployments via GitHub Actions and manual deployments using the Firebase CLI.

## Automated Deployment (CI/CD)

The project includes a GitHub Actions workflow (`.github/workflows/firebase-hosting-merge.yml`) that automatically builds and deploys the application when changes are pushed to the `main` branch.

### Prerequisites for CI/CD

To make the automated deployment work, you must configure the following **Secrets** in your GitHub Repository settings:

-   `FIREBASE_SERVICE_ACCOUNT_EQUIPTALK_317D8`: The service account JSON for authentication.
-   `NEXT_PUBLIC_FIREBASE_API_KEY`
-   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
-   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
-   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
-   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
-   `NEXT_PUBLIC_FIREBASE_APP_ID`
-   `DATABASE_URL`

### Workflow Overview

1.  **Trigger:** Push to `main`.
2.  **Build:** Installs dependencies and runs `npm run build`.
3.  **Deploy:** Uses `firebase-tools` to deploy the built assets to Firebase Hosting.

## Manual Deployment

You can also deploy the application manually from your local machine.

1.  **Login to Firebase:**
    ```bash
    firebase login
    ```

2.  **Build the application:**
    ```bash
    npm run build
    ```

3.  **Deploy to Firebase Hosting:**
    ```bash
    firebase deploy --only hosting
    ```

## Troubleshooting

### "Missing permissions"
Ensure your Firebase service account has the `Firebase Hosting Admin` role.

### "Validation failed"
Check that your `.firebaserc` file points to the correct project ID and that `firebase.json` is configured correctly for your build output directory options.
