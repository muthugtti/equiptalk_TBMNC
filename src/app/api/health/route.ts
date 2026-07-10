import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        let connected = false;
        try {
            const db = await getDb();
            // Cheapest possible read just to confirm Firestore is reachable —
            // avoid listCollections(), which enumerates schema to any caller.
            await db.collection('equipment').limit(1).get();
            connected = true;
        } catch (dbError: any) {
            console.error("Health check DB error:", dbError.message);
        }

        return NextResponse.json(
            { status: connected ? "online" : "partial_outage" },
            {
                status: connected ? 200 : 503,
                headers: { "Cache-Control": "no-store, max-age=0" },
            }
        );
    } catch (error: any) {
        console.error("Health check fatal error:", error);
        return NextResponse.json({ status: "error" }, { status: 500 });
    }
}
