import "server-only";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function buildCredential() {
  // Option 1: FIREBASE_SERVICE_ACCOUNT_JSON env var (base64-encoded or raw JSON string)
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(
        json.startsWith("{") ? json : Buffer.from(json, "base64").toString("utf8")
      );
      return admin.credential.cert(parsed);
    } catch (e) {
      console.error("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e);
    }
  }

  // Option 2: GOOGLE_APPLICATION_CREDENTIALS points to a JSON key file on disk
  // admin.credential.applicationDefault() picks this up automatically.
  return admin.credential.applicationDefault();
}

export async function initAdmin() {
  if (admin.apps.length > 0) return admin.app();

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    process.env.FIREBASE_PROJECT_ID ??
    "equiptalk-317d8";

  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "equiptalk-317d8.firebasestorage.app";

  try {
    const app = admin.initializeApp({ credential: buildCredential(), projectId, storageBucket });
    return app;
  } catch (error: any) {
    console.error("[Firebase Admin] Init error:", error.message);
    throw error;
  }
}

let firestoreInstance: FirebaseFirestore.Firestore | null = null;

export const getDb = async (): Promise<FirebaseFirestore.Firestore> => {
  if (firestoreInstance) return firestoreInstance;
  await initAdmin();
  firestoreInstance = getFirestore();
  return firestoreInstance;
};

let storageInstance: ReturnType<ReturnType<typeof getStorage>["bucket"]> | null = null;

export const getStorageBucket = async () => {
  if (storageInstance) return storageInstance;
  await initAdmin();
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set");
  storageInstance = getStorage().bucket(bucketName);
  return storageInstance;
};
