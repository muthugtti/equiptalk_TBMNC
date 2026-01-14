import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log("Health check called");

        // Initialize check
        const checks: any = {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        };

        // Try to perform a simple Firestore operation
        try {
            const db = await getDb();
            checks.firestoreRef = !!db;
            const collections = await db.listCollections();
            checks.connection = "success";
            checks.collections = collections.map(c => c.id);
        } catch (dbError: any) {
            checks.connection = "failed";
            checks.dbError = dbError.message;
        }

        return NextResponse.json({
            status: checks.connection === "success" ? "online" : "partial_outage",
            checks,
            env: {
                nodeEnv: process.env.NODE_ENV,
            }
        });
    } catch (error: any) {
        console.error("Health check fatal error:", error);
        return NextResponse.json({
            status: "error",
            error: String(error),
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
