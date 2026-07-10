import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = 'force-dynamic';

const INCIDENTS_RATE_LIMIT = { maxAttempts: 60, windowMs: 15 * 60 * 1000, lockoutMs: 5 * 60 * 1000 };

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`incidents:${auth.uid}`, true, INCIDENTS_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Too many requests." }, {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)) },
        });
    }

    try {
        const db = await getDb();
        // Scope to the authenticated account only. Filter by createdBy and sort in
        // memory to avoid a composite index. NOTE: legacy incidents without a
        // `createdBy` field will not appear (strict security scoping).
        const snapshot = await db.collection('incidents').where('createdBy', '==', auth.uid).get();
        const incidents = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as { id: string; createdAt?: string }))
            .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
        return NextResponse.json({ incidents });
    } catch (error: any) {
        console.error("Error fetching incidents:", error);
        return NextResponse.json({ error: "Failed to fetch incidents" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`incidents:${auth.uid}`, true, INCIDENTS_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Too many requests." }, {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)) },
        });
    }

    try {
        const db = await getDb();
        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { equipmentId, equipmentName, issueDescription, status, priority } = body;

        if (!equipmentId || !equipmentName || !issueDescription) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const displayId = `INC-${Date.now()}`;
        const newIncident = {
            displayId,
            equipmentId,
            equipmentName,
            issueDescription,
            status: status || "open",
            priority: priority || "low",
            createdBy: auth.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const docRef = await db.collection('incidents').add(newIncident);
        return NextResponse.json({ id: docRef.id, ...newIncident }, { status: 201 });
    } catch (error: any) {
        console.error("Error creating incident:", error);
        return NextResponse.json({ error: "Failed to create incident" }, { status: 500 });
    }
}
