import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const { id } = params;
        if (!id) {
            return NextResponse.json({ error: "Incident ID provided" }, { status: 400 });
        }

        const db = await getDb();
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        // Filter out fields that shouldn't be updated directly if necessary (like id, createdAt)
        // For now, we update updatedAt
        const updateData = {
            ...body,
            updatedAt: new Date().toISOString()
        };

        // Remove id or displayId from updateData if they exist to prevent overwriting keys lightly
        delete updateData.id;
        delete updateData.displayId;
        delete updateData.createdAt;

        await db.collection('incidents').doc(id).update(updateData);

        return NextResponse.json({ success: true, id, ...updateData });

    } catch (error: any) {
        console.error("Error updating incident:", error);
        return NextResponse.json({
            error: "Failed to update incident",
            details: error.message
        }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const { id } = params;
        if (!id) {
            return NextResponse.json({ error: "Incident ID not provided" }, { status: 400 });
        }

        const db = await getDb();
        await db.collection('incidents').doc(id).delete();

        return NextResponse.json({ success: true, id });

    } catch (error: any) {
        console.error("Error deleting incident:", error);
        return NextResponse.json({
            error: "Failed to delete incident",
            details: error.message
        }, { status: 500 });
    }
}
