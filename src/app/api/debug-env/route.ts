
import { NextResponse } from 'next/server';

// Remove top-level imports to prevent crash on load
// import * as admin from 'firebase-admin';
// import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const envVars = {
        NODE_ENV: process.env.NODE_ENV,
        GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    };

    let dbStatus = 'Skipped (use ?connect=true to test)';
    let errorMsg = '';
    let apps = 0;
    let importStatus = 'Pending';

    try {
        const { searchParams } = new URL(req.url);
        const shouldConnect = searchParams.get('connect') === 'true';

        // Lazy load modules to catch import errors
        importStatus = 'Loading firebase-admin...';
        const admin = await import('firebase-admin');
        importStatus = 'Loading @/lib/firebase-admin...';
        const { getDb } = await import('@/lib/firebase-admin');
        importStatus = 'Imports Successful';

        if (shouldConnect) {
            try {
                const db = await getDb();
                dbStatus = 'Connected';

                // admin.default because of dynamic import structure potentially
                const adminApp = admin.default || admin;
                apps = adminApp.apps ? adminApp.apps.length : 0;

                // Try a simple read
                await db.collection('test').limit(1).get();
                dbStatus = 'Connected & Verified Read';
            } catch (e: any) {
                dbStatus = 'Connection Failed';
                errorMsg = e.message;
            }
        } else {
            const adminApp = admin.default || admin;
            apps = adminApp.apps ? adminApp.apps.length : 0;
        }

        return NextResponse.json({
            status: 'ok',
            env: envVars,
            firebase: {
                importStatus,
                appsCount: apps,
                dbStatus,
                error: errorMsg,
                note: 'Add ?connect=true to URL to test actual DB connection'
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message,
            stack: error.stack,
            failedAt: importStatus,
            env: envVars // Return env even on crash if possible
        }, { status: 200 }); // Return 200 so we can see the error in browser without 500ing
    }
}
