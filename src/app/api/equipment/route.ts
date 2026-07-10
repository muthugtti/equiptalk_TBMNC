import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { v4 as uuidv4 } from "uuid";

const EQUIPMENT_RATE_LIMIT = { maxAttempts: 100, windowMs: 15 * 60 * 1000, lockoutMs: 5 * 60 * 1000 };

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`equipment:${auth.uid}`, true, EQUIPMENT_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Too many requests." }, {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)) },
        });
    }

    try {
        const db = await getDb();
        // Scope to the authenticated account only. Filter by createdBy and sort
        // in memory to avoid a composite index requirement. NOTE: legacy records
        // without a `createdBy` field will not appear (strict security scoping).
        const snapshot = await db.collection('equipment').where('createdBy', '==', auth.uid).get();
        const equipment = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as { id: string; updatedAt?: string }))
            .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
        return NextResponse.json({ equipment });
    } catch (error: any) {
        console.error("Error fetching equipment:", error);
        return NextResponse.json({ error: "Failed to fetch equipment" }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`equipment:${auth.uid}`, true, EQUIPMENT_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Too many requests." }, {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)) },
        });
    }

    try {
        let db;
        try {
            db = await getDb();
        } catch (dbError: any) {
            console.error("Failed to get DB instance:", dbError);
            return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
        }

        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { name, type, model, serialNumber, status, organizationId, parentId } = body;

        if (!name || !type || !organizationId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const existingSnapshot = await db.collection('equipment').where('slug', '==', slug).limit(1).get();
        if (!existingSnapshot.empty) {
            slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
        }

        const equipmentData = {
            name,
            type,
            model: model || "",
            serialNumber: serialNumber || "",
            status: status || "OPERATIONAL",
            organizationId,
            parentId: parentId || null,
            order: 0,
            slug,
            createdBy: auth.uid,
            // Unguessable token for public QR access; the raw doc id is never
            // exposed publicly. Public access is opt-in per equipment.
            publicLinkId: uuidv4(),
            isPublicAccessEnabled: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const docRef = await db.collection('equipment').add(equipmentData);
        return NextResponse.json({ id: docRef.id, ...equipmentData }, { status: 201 });
    } catch (error: any) {
        console.error("Error creating equipment:", error);
        return NextResponse.json({ error: "Failed to create equipment" }, { status: 500 });
    }
}
