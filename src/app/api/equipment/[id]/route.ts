
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const db = await getDb();
        const docRef = db.collection('equipment').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }

        return NextResponse.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        console.error("Error fetching equipment:", error);
        return NextResponse.json({ error: "Failed to fetch equipment" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const db = await getDb();

        const docRef = db.collection('equipment').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }

        const updatedData = {
            ...body,
            updatedAt: new Date().toISOString()
        };

        // Remove immutable or unrelated fields if necessary, for now trusting inputs but secure apps validte
        delete updatedData.id;
        delete updatedData.createdAt; // Should probably remain creation time

        await docRef.update(updatedData);

        return NextResponse.json({ id, ...updatedData });
    } catch (error) {
        console.error("Error updating equipment:", error);
        return NextResponse.json({ error: "Failed to update equipment" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const db = await getDb();

        await db.collection('equipment').doc(id).delete();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting equipment:", error);
        return NextResponse.json({ error: "Failed to delete equipment" }, { status: 500 });
    }
}
