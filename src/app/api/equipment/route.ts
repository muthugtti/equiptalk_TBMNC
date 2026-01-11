
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
    try {
        const db = await getDb();
        const equipmentRef = db.collection('equipment');
        const snapshot = await equipmentRef.get();

        const equipment = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ equipment });
    } catch (error) {
        console.error("Error fetching equipment:", error);
        return NextResponse.json({ error: "Failed to fetch equipment" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, type, model, serialNumber, status, organizationId, parentId } = body;

        if (!name || !type || !organizationId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const db = await getDb();

        // Slug generation
        let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const existing = await db.collection('equipment').where('slug', '==', slug).get();
        if (!existing.empty) {
            slug = `${slug}-${uuidv4().slice(0, 4)}`;
        }

        const newEquipment = {
            name,
            type,
            model: model || "",
            serialNumber: serialNumber || "",
            status: status || "OPERATIONAL",
            organizationId,
            parentId: parentId || null,
            slug,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const docRef = await db.collection('equipment').add(newEquipment);

        return NextResponse.json({ id: docRef.id, ...newEquipment }, { status: 201 });
    } catch (error) {
        console.error("Error creating equipment:", error);
        return NextResponse.json({ error: "Failed to create equipment" }, { status: 500 });
    }
}
