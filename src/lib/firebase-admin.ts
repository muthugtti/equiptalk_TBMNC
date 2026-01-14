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
        // Fallback to known project ID if env vars are missing in Cloud Run context
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID ||
            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
            process.env.FIREBASE_PROJECT_ID ||
            'equiptalk-317d8';

        // Log project ID attempt (sanitized for safety)
        console.log(`[Firebase Admin] Attempting to init. Project ID: ${projectId}`);

        if (!projectId) {
            console.error('[Firebase Admin] Missing Project ID env var');
            throw new Error('Firebase project ID not found in environment variables');
        }

        console.log(`[Firebase Admin] Initializing with project: ${projectId}`);

        // Check if we are in a Firebase Functions environment
        if (process.env.FIREBASE_CONFIG) {
            console.log('[Firebase Admin] Detected FIREBASE_CONFIG, assuming Cloud defaults.');
            // When deployed to Firebase, often initializeApp() with no args is best 
            // as it reads FIREBASE_CONFIG automatically.
            // However, passing projectId explicitly is safe.
        }

        const app = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: projectId,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'equiptalk-317d8.firebasestorage.app'
        });

        console.log('[Firebase Admin] Initialized successfully');
        return app;
    } catch (error: any) {
        console.error('[Firebase Admin] Initialization error:', error.message);
        // Try one last ditch attempt with no args if the above failed (e.g. credential issues)
        try {
            if (admin.apps.length === 0) {
                console.log('[Firebase Admin] Retrying with default initializeApp()...');
                return admin.initializeApp();
            }
        } catch (retryError) {
            console.error('[Firebase Admin] Retry failed:', retryError);
        }
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
