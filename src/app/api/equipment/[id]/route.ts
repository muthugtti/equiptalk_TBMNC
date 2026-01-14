import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const db = await getDb();
        const { id } = await params;
        const docRef = db.collection('equipment').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }

        // Get documents for this equipment
        const documentsSnapshot = await db.collection('documents')
            .where('equipmentId', '==', id)
            .get();

        const documents = documentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({
            id: doc.id,
            ...doc.data(),
            documents
        });
    } catch (error: any) {
        console.error("Error fetching equipment:", error);
        return NextResponse.json({
            error: "Failed to fetch equipment",
            details: error.message
        }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const db = await getDb();
        const { id } = await params;
        const body = await req.json();

        const docRef = db.collection('equipment').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }

        const updateData = {
            ...body,
            updatedAt: new Date().toISOString()
        };

        await docRef.update(updateData);

        return NextResponse.json({
            id,
            ...doc.data(),
            ...updateData
        });
    } catch (error: any) {
        console.error("Error updating equipment:", error);
        return NextResponse.json({
            error: "Failed to update equipment",
            details: error.message
        }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const db = await getDb();
        const { id } = await params;

        // 1. Get Equipment Data (for Image URL)
        const docRef = db.collection('equipment').doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }
        const equipmentData = docSnap.data();

        // 2. Get Associated Documents
        const documentsSnapshot = await db.collection('documents')
            .where('equipmentId', '==', id)
            .get();

        // 3. Initialize Storage
        // Import dynamically to avoid circular dependecy issues if any, though standard import is fine usually.
        const { getStorageBucket } = await import("@/lib/firebase-admin");
        const bucket = await getStorageBucket();

        // 4. Delete Document Files from Storage
        const fileDeletePromises: Promise<any>[] = [];

        documentsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.filename) {
                console.log(`[Delete] Scheduling deletion for document file: ${data.filename}`);
                fileDeletePromises.push(
                    bucket.file(data.filename).delete().catch(e =>
                        console.warn(`Failed to delete document file ${data.filename}:`, e.message)
                    )
                );
            }
        });

        // 5. Delete Main Image from Storage
        if (equipmentData?.imageUrl && equipmentData.imageUrl.includes("firebasestorage.googleapis.com")) {
            try {
                // Extract path from URL: .../o/equipment%2F[id]%2Ffile.jpg?alt=...
                const url = new URL(equipmentData.imageUrl);
                const pathStart = url.pathname.indexOf('/o/');
                if (pathStart !== -1) {
                    const encodedPath = url.pathname.substring(pathStart + 3);
                    const filePath = decodeURIComponent(encodedPath);
                    console.log(`[Delete] Scheduling deletion for image file: ${filePath}`);
                    fileDeletePromises.push(
                        bucket.file(filePath).delete().catch(e =>
                            console.warn(`Failed to delete image file ${filePath}:`, e.message)
                        )
                    );
                }
            } catch (e) {
                console.warn("Failed to parse image URL for deletion:", e);
            }
        }

        // Wait for all file deletions (don't block DB delete on failure, just log)
        await Promise.allSettled(fileDeletePromises);

        // 6. Delete Database Records (Batch)
        const batch = db.batch();
        documentsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        batch.delete(docRef);

        await batch.commit();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting equipment:", error);
        return NextResponse.json({
            error: "Failed to delete equipment",
            details: error.message
        }, { status: 500 });
    }
}
