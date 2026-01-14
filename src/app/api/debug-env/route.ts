
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const envVars = {
            NODE_ENV: process.env.NODE_ENV,
            GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
            GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
            FIREBASE_CONFIG: process.env.FIREBASE_CONFIG ? 'Present' : 'Missing',
            K_SERVICE: process.env.K_SERVICE,
            NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
        };

        let dbStatus = 'Skipped (use ?connect=true to test)';
        let errorMsg = '';
        let apps = 0;

        const { searchParams } = new URL(req.url);
        const shouldConnect = searchParams.get('connect') === 'true';

        if (shouldConnect) {
            try {
                const db = await getDb();
                dbStatus = 'Connected';
                apps = admin.apps.length;
                // Try a simple read
                await db.collection('test').limit(1).get();
                dbStatus = 'Connected & Verified Read';
            } catch (e: any) {
                dbStatus = 'Connection Failed';
                errorMsg = e.message;
            }
        } else {
            apps = admin.apps ? admin.apps.length : 0;
        }

        return NextResponse.json({
            status: 'ok',
            env: envVars,
            firebase: {
                appsCount: apps,
                dbStatus,
                error: errorMsg,
                note: 'Add ?connect=true to URL to test actual DB connection'
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
