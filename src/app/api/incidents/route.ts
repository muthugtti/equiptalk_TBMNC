import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const db = await getDb();
        const incidentsRef = db.collection('incidents');
        const snapshot = await incidentsRef.orderBy('createdAt', 'desc').get();

        const incidents = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ incidents });
    } catch (error: any) {
        console.error("Error fetching incidents:", error);
        return NextResponse.json({
            error: "Failed to fetch incidents",
            details: error.message
        }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const db = await getDb();
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { equipmentId, equipmentName, issueDescription, status, priority } = body;

        // Basic validation
        if (!equipmentId || !equipmentName || !issueDescription) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Generate a human-readable ID component (optional, but good for display)
        // For simplicity, we'll let Firestore generate the document ID, 
        // but we can generate a display ID if needed. Let's stick to Firestore ID for now or generate one.
        // The requirements asked for "ID - Auto generate". 
        // Let's generate a display ID like "INC-<TIMESTAMP>" as per plan.
        const displayId = `INC-${Date.now()}`;

        const newIncident = {
            displayId,
            equipmentId,
            equipmentName,
            issueDescription,
            status: status || "open",
            priority: priority || "low",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await db.collection('incidents').add(newIncident);

        return NextResponse.json({
            id: docRef.id,
            ...newIncident
        }, { status: 201 });

    } catch (error: any) {
        console.error("Error creating incident:", error);
        return NextResponse.json({
            error: "Failed to create incident",
            details: error.message
        }, { status: 500 });
    }
}
