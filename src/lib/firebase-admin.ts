
import "server-only";
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

interface FirebaseAdminConfig {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

function formatPrivateKey(key: string) {
    return key.replace(/\\n/g, '\n');
}

export function createFirebaseAdminApp(params: FirebaseAdminConfig) {
    const privateKey = formatPrivateKey(params.privateKey);

    if (admin.apps.length > 0) {
        return admin.app();
    }

    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId: params.projectId,
            clientEmail: params.clientEmail,
            privateKey,
        }),
    });
}

export async function initAdmin() {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    // Use application default credentials or fall back to env vars if needed
    // Ideally locally we use GOOGLE_APPLICATION_CREDENTIALS json file path for ADC
    // Or FIREBASE_SERVICE_ACCOUNT_KEY if we are doing explicit cert

    // For this environment, if we don't have explicit creds, we might rely on ADC if gcloud auth is set up
    // Or we expect env vars.

    // Simple fallback using env vars for specific creds if provided, else ADC
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

    return admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId,
    });
}

// Singleton-ish access to Firestore
let firestoreInstance: FirebaseFirestore.Firestore | null = null;

export const getDb = async () => {
    if (firestoreInstance) return firestoreInstance;

    await initAdmin();
    firestoreInstance = getFirestore();
    return firestoreInstance;
}
