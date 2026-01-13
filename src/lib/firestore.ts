import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
const getFirebaseAdminApp = () => {
    if (getApps().length === 0) {
        return initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
    }
    return getApp();
};

const app = getFirebaseAdminApp();
export const db = getFirestore(app);
