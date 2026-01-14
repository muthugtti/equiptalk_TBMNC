import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    try {
        const db = await getDb();
        const { searchParams } = new URL(req.url);
        const equipmentId = searchParams.get('equipmentId');

        let query = db.collection('documents');

        if (equipmentId) {
            query = query.where('equipmentId', '==', equipmentId) as any;
        }

        const snapshot = await query.orderBy('createdAt', 'desc').get();

        const documents = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ documents });
    } catch (error: any) {
        console.error("Error fetching documents:", error);
        return NextResponse.json({
            error: "Failed to fetch documents",
            details: error.message
        }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const db = await getDb();
        const body = await req.json();
        const { name, url, filename, type, equipmentId } = body;

        if (!name || !url || !equipmentId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const documentData = {
            name,
            url,
            filename: filename || "", // Optional to support legacy manual entries
            type: type || "document",
            equipmentId,
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection('documents').add(documentData);

        return NextResponse.json({
            id: docRef.id,
            ...documentData
        }, { status: 201 });
    } catch (error: any) {
        console.error("Error creating document:", error);
        return NextResponse.json({
            error: "Failed to create document",
            details: error.message
        }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const db = await getDb();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
        }

        // Get document to find the file path (if stored) or try to construct it
        const docRef = db.collection('documents').doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        const docData = docSnap.data();

        // Delete from Storage if we have a filename reference
        // (Note: The new upload API saves 'filename', legacy ones might not have it)
        if (docData?.filename) {
            try {
                // Dynamic import to avoid circular dependencies if any, 
                // but here we just need the bucket
                const { getStorageBucket } = await import("@/lib/firebase-admin");
                const bucket = await getStorageBucket();
                await bucket.file(docData.filename).delete();
            } catch (storageError) {
                console.warn("Failed to delete file from storage (might rely on manual cleanup or file not found):", storageError);
                // Proceed to delete metadata anyway
            }
        }

        await docRef.delete();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting document:", error);
        return NextResponse.json({
            error: "Failed to delete document",
            details: error.message
        }, { status: 500 });
    }
}
