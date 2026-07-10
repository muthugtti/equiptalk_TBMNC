import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_UPDATE_FIELDS = new Set([
    'name', 'type', 'model', 'serialNumber', 'status',
    'parentId', 'order', 'imageUrl', 'imagePrompt', 'notes', 'location', 'manufacturer',
    // Agent configuration — applied to the chat system prompt / generation.
    'customInstructions', 'persona', 'responseStyle', 'temperature',
    // Public access toggle. publicLinkId is NOT here on purpose — it is
    // server-generated so a client can't set a chosen/guessable token.
    'isPublicAccessEnabled',
]);

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const db = await getDb();
        const { id } = await params;
        const docRef = db.collection('equipment').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }

        // Ownership scoping: never reveal another account's equipment (or its
        // documents). Return 404 rather than 403 so foreign ids are indistinguishable
        // from non-existent ones. Legacy records without createdBy are hidden.
        if (doc.data()?.createdBy !== auth.uid) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }

        const documentsSnapshot = await db.collection('documents').where('equipmentId', '==', id).get();
        const documents = documentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json({ id: doc.id, ...doc.data(), documents });
    } catch (error: any) {
        console.error("Error fetching equipment:", error);
        return NextResponse.json({ error: "Failed to fetch equipment" }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const db = await getDb();
        const { id } = await params;
        const body = await req.json();

        const docRef = db.collection('equipment').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }

        const existingData = doc.data();
        // Ownership check: if createdBy is set, only the creator may mutate.
        if (existingData?.createdBy && existingData.createdBy !== auth.uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Field allowlist — prevents mass-assignment of internal/immutable fields.
        const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        for (const [key, value] of Object.entries(body)) {
            if (ALLOWED_UPDATE_FIELDS.has(key)) {
                updateData[key] = value;
            }
        }

        // Legacy equipment created before public links existed won't have a
        // publicLinkId. Mint one the first time public access is turned on so
        // the QR code has a stable token to point at.
        if (updateData.isPublicAccessEnabled === true && !existingData?.publicLinkId) {
            updateData.publicLinkId = uuidv4();
        }

        await docRef.update(updateData);
        return NextResponse.json({ id, ...existingData, ...updateData });
    } catch (error: any) {
        console.error("Error updating equipment:", error);
        return NextResponse.json({ error: "Failed to update equipment" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const db = await getDb();
        const { id } = await params;

        const docRef = db.collection('equipment').doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }

        const equipmentData = docSnap.data();

        // Ownership check.
        if (equipmentData?.createdBy && equipmentData.createdBy !== auth.uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const documentsSnapshot = await db.collection('documents').where('equipmentId', '==', id).get();

        const { getStorageBucket } = await import("@/lib/firebase-admin");
        const bucket = await getStorageBucket();

        const fileDeletePromises: Promise<any>[] = [];

        documentsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.filename) {
                fileDeletePromises.push(
                    bucket.file(data.filename).delete().catch((e: any) =>
                        console.warn(`Failed to delete document file ${data.filename}:`, e.message)
                    )
                );
            }
        });

        if (equipmentData?.imageUrl && equipmentData.imageUrl.includes("firebasestorage.googleapis.com")) {
            try {
                const url = new URL(equipmentData.imageUrl);
                const pathStart = url.pathname.indexOf('/o/');
                if (pathStart !== -1) {
                    const filePath = decodeURIComponent(url.pathname.substring(pathStart + 3));
                    fileDeletePromises.push(
                        bucket.file(filePath).delete().catch((e: any) =>
                            console.warn(`Failed to delete image file:`, e.message)
                        )
                    );
                }
            } catch {
                // Ignore URL parse errors.
            }
        }

        await Promise.allSettled(fileDeletePromises);

        const batch = db.batch();
        documentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        const [textSnap, chunksSnap] = await Promise.all([
            db.collection('equipment_docs_text').where('equipmentId', '==', id).get(),
            db.collection('equipment_doc_chunks').where('equipmentId', '==', id).get(),
        ]);
        textSnap.docs.forEach(doc => batch.delete(doc.ref));
        chunksSnap.docs.forEach(doc => batch.delete(doc.ref));

        batch.delete(docRef);
        await batch.commit();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting equipment:", error);
        return NextResponse.json({ error: "Failed to delete equipment" }, { status: 500 });
    }
}
