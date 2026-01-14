import "server-only";
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * Initialize Firebase Admin SDK
 * Supports both local development (via ADC) and production (via env vars)
 * 
 * Local: Use `gcloud auth application-default login` for ADC
 * Production: Credentials are automatically provided by Cloud Run/Functions
 */
export async function initAdmin() {
    // Simplified initialization for Cloud Run / Firebase Functions
    if (admin.apps.length > 0) {
        return admin.app();
    }

    try {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID ||
            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
            process.env.FIREBASE_PROJECT_ID ||
            'equiptalk-317d8';

        console.log(`[Firebase Admin] Init with project: ${projectId}`);

        // In Cloud Run / Functions, this often auto-detects credentials
        const app = admin.initializeApp({
            projectId: projectId,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'equiptalk-317d8.firebasestorage.app'
        });

        console.log('[Firebase Admin] Initialized successfully');
        return app;
    } catch (error: any) {
        console.error('[Firebase Admin] Initialization error:', error.message);
        throw error;
    }
}

// Singleton Firestore instance
let firestoreInstance: FirebaseFirestore.Firestore | null = null;

/**
 * Get Firestore database instance
 * Automatically initializes Firebase Admin if needed
 */
export const getDb = async (): Promise<FirebaseFirestore.Firestore> => {
    if (firestoreInstance) {
        return firestoreInstance;
    }

    await initAdmin();
    firestoreInstance = getFirestore();
    return firestoreInstance;
}

// Singleton Storage instance
let storageInstance: any = null;

export const getStorageBucket = async () => {
    if (storageInstance) {
        return storageInstance;
    }

    await initAdmin();
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
        throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set");
    }
    console.log(`[Firebase Admin] Using storage bucket: ${bucketName}`);
    storageInstance = getStorage().bucket(bucketName);
    return storageInstance;
}
