import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = 'force-dynamic';

// Only these fields may be updated by the client.
const ALLOWED_INCIDENT_UPDATE_FIELDS = new Set([
    'status', 'priority', 'issueDescription', 'equipmentName', 'resolution', 'notes',
]);

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await props.params;
        if (!id) {
            return NextResponse.json({ error: "Incident ID required" }, { status: 400 });
        }

        const db = await getDb();

        const docRef = db.collection('incidents').doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Incident not found" }, { status: 404 });
        }

        const existingData = docSnap.data();
        if (existingData?.createdBy && existingData.createdBy !== auth.uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        // Field allowlist — prevents overwriting immutable or internal fields.
        const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        for (const [key, value] of Object.entries(body)) {
            if (ALLOWED_INCIDENT_UPDATE_FIELDS.has(key)) {
                updateData[key] = value;
            }
        }

        await docRef.update(updateData);
        return NextResponse.json({ success: true, id, ...updateData });
    } catch (error: any) {
        console.error("Error updating incident:", error);
        return NextResponse.json({ error: "Failed to update incident" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await props.params;
        if (!id) {
            return NextResponse.json({ error: "Incident ID not provided" }, { status: 400 });
        }

        const db = await getDb();

        const docRef = db.collection('incidents').doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Incident not found" }, { status: 404 });
        }

        const existingData = docSnap.data();
        if (existingData?.createdBy && existingData.createdBy !== auth.uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await docRef.delete();
        return NextResponse.json({ success: true, id });
    } catch (error: any) {
        console.error("Error deleting incident:", error);
        return NextResponse.json({ error: "Failed to delete incident" }, { status: 500 });
    }
}
