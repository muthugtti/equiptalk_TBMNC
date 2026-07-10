import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const REORDER_RATE_LIMIT = { maxAttempts: 30, windowMs: 15 * 60 * 1000, lockoutMs: 5 * 60 * 1000 };
const MAX_REORDER_ITEMS = 500;

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`reorder:${auth.uid}`, true, REORDER_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Too many requests." }, {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)) },
        });
    }

    try {
        const db = await getDb();
        const body = await req.json();
        const { items } = body;

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: "Invalid items format" }, { status: 400 });
        }

        if (items.length > MAX_REORDER_ITEMS) {
            return NextResponse.json({ error: `Cannot reorder more than ${MAX_REORDER_ITEMS} items at once` }, { status: 400 });
        }

        // Validate ownership: fetch all referenced docs and verify createdBy.
        const ids: string[] = items.map((item: any) => String(item.id)).filter(Boolean);
        const fetchedDocs = await Promise.all(
            ids.map(id => db.collection('equipment').doc(id).get())
        );

        for (const doc of fetchedDocs) {
            if (!doc.exists) {
                return NextResponse.json({ error: `Equipment ${doc.id} not found` }, { status: 404 });
            }
            const data = doc.data();
            // Block mutations on records owned by a different user.
            if (data?.createdBy && data.createdBy !== auth.uid) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const batch = db.batch();
        items.forEach((item: { id: string; order: number; parentId?: string | null }) => {
            const docRef = db.collection('equipment').doc(item.id);
            const updateData: any = { order: item.order };
            if (item.parentId !== undefined) {
                updateData.parentId = item.parentId;
            }
            batch.update(docRef, updateData);
        });

        await batch.commit();
        return NextResponse.json({ success: true, count: items.length });
    } catch (error: any) {
        console.error("Error reordering equipment:", error);
        return NextResponse.json({ error: "Failed to reorder equipment" }, { status: 500 });
    }
}
