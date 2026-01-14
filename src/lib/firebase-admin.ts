
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
    if (admin.apps.length > 0) {
        return admin.app();
    }

    try {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID ||
            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
            process.env.FIREBASE_PROJECT_ID;

        if (!projectId) {
            throw new Error('Firebase project ID not found in environment variables');
        }

        console.log(`[Firebase Admin] Initializing with project: ${projectId}`);

        const app = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: projectId,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        });

        console.log('[Firebase Admin] Initialized successfully');
        return app;
    } catch (error: any) {
        console.error('[Firebase Admin] Initialization error:', error.message);
        console.error('[Firebase Admin] Ensure you have run: gcloud auth application-default login');
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
    storageInstance = getStorage().bucket();
    return storageInstance;
}
