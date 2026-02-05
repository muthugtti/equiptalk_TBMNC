# Setup Guide

This guide will help you set up the Equiptalk AI project locally for development.

## Prerequisites

Ensure you have the following installed on your machine:

-   **Node.js:** Version 20 or higher.
-   **npm:** Comes with Node.js.
-   **Git:** For version control.
-   **Firebase CLI:** Install globally via npm:
    ```bash
    npm install -g firebase-tools
    ```

## Cloning the Repository

```bash
git clone https://github.com/muthugtti/equiptalk-ai.git
cd equiptalk-ai
```

## Environment Configuration

The application requires several environment variables to connect to Firebase and other services.

1.  **Create a `.env.local` file:**
    Copy the example or create a new file named `.env.local` in the project root.

2.  **Add your Firebase Configuration:**
    You can attain these values from your Firebase Project Console under **Project Settings > General**.

    ```bash
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    ```

3.  **Database Connection (Optional/If applicable):**
    If using a PostgreSQL database alongside Firebase:
    ```bash
    DATABASE_URL="postgresql://user:password@localhost/dbname"
    ```

## Installation

Install the project dependencies:

```bash
npm install
```

## Running Locally

Start the development server:

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Firebase Emulators (Optional)

If you wish to run Firebase services locally (Firestore, Functions), you can use the Firebase Emulators:

```bash
firebase emulators:start
```
