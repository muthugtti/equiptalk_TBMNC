import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firestore";

export async function GET(req: NextRequest) {
    try {
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
        const body = await req.json();
        const { name, url, type, equipmentId } = body;

        if (!name || !url || !equipmentId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const documentData = {
            name,
            url,
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
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
        }

        await db.collection('documents').doc(id).delete();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting document:", error);
        return NextResponse.json({
            error: "Failed to delete document",
            details: error.message
        }, { status: 500 });
    }
}
