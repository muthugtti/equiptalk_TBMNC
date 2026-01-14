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

        // Delete all documents associated with this equipment
        const documentsSnapshot = await db.collection('documents')
            .where('equipmentId', '==', id)
            .get();

        const batch = db.batch();
        documentsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete the equipment
        batch.delete(db.collection('equipment').doc(id));

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
