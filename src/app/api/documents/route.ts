import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth, isEquipmentOwnedBy } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const DOCUMENTS_RATE_LIMIT = { maxAttempts: 60, windowMs: 15 * 60 * 1000, lockoutMs: 5 * 60 * 1000 };

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`documents:${auth.uid}`, true, DOCUMENTS_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Too many requests." }, {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)) },
        });
    }

    try {
        const db = await getDb();
        const { searchParams } = new URL(req.url);
        const equipmentId = searchParams.get('equipmentId');

        // When filtered by equipmentId, verify that equipment belongs to the
        // caller so a user can't pass someone else's id to read their docs.
        if (equipmentId && !(await isEquipmentOwnedBy(equipmentId, auth.uid))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Scope to the authenticated account. Filter by createdBy and (optionally)
        // equipmentId, then sort in memory to avoid composite index requirements.
        // NOTE: legacy documents without a `createdBy` field will not appear.
        let query: FirebaseFirestore.Query = db.collection('documents').where('createdBy', '==', auth.uid);
        if (equipmentId) {
            query = query.where('equipmentId', '==', equipmentId);
        }

        const snapshot = await query.get();
        const documents = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as { id: string; createdAt?: string }))
            .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
        return NextResponse.json({ documents });
    } catch (error: any) {
        console.error("Error fetching documents:", error);
        return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`documents:${auth.uid}`, true, DOCUMENTS_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Too many requests." }, {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)) },
        });
    }

    try {
        const db = await getDb();
        const body = await req.json();
        const { name, url, filename, type, equipmentId } = body;

        if (!name || !url || !equipmentId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Don't allow attaching a document record to another account's equipment.
        if (!(await isEquipmentOwnedBy(equipmentId, auth.uid))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const documentData = {
            name,
            url,
            filename: filename || "",
            type: type || "document",
            equipmentId,
            createdBy: auth.uid,
            createdAt: new Date().toISOString(),
        };

        const docRef = await db.collection('documents').add(documentData);
        return NextResponse.json({ id: docRef.id, ...documentData }, { status: 201 });
    } catch (error: any) {
        console.error("Error creating document:", error);
        return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`documents:${auth.uid}`, true, DOCUMENTS_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Too many requests." }, {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)) },
        });
    }

    try {
        const db = await getDb();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
        }

        const docRef = db.collection('documents').doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        const docData = docSnap.data();

        // Ownership check.
        if (docData?.createdBy && docData.createdBy !== auth.uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (docData?.filename) {
            try {
                const { getStorageBucket } = await import("@/lib/firebase-admin");
                const bucket = await getStorageBucket();
                await bucket.file(docData.filename).delete();
            } catch {
                // Non-fatal: proceed with metadata deletion.
            }
        } else if (docData?.url && docData.url.includes("firebasestorage.googleapis.com")) {
            try {
                const { getStorageBucket } = await import("@/lib/firebase-admin");
                const bucket = await getStorageBucket();
                const urlObj = new URL(docData.url);
                const pathStart = urlObj.pathname.indexOf('/o/');
                if (pathStart !== -1) {
                    const filePath = decodeURIComponent(urlObj.pathname.substring(pathStart + 3));
                    await bucket.file(filePath).delete();
                }
            } catch {
                // Non-fatal.
            }
        }

        await docRef.delete();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting document:", error);
        return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
    }
}
