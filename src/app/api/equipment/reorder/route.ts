import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
    try {
        const db = await getDb();
        const body = await req.json();
        const { items } = body;

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: "Invalid items format" }, { status: 400 });
        }

        const batch = db.batch();

        items.forEach((item: { id: string; order: number; parentId?: string | null }) => {
            const docRef = db.collection('equipment').doc(item.id);
            const updateData: any = { order: item.order };

            // Only update parentId if it's explicitly provided
            if (item.parentId !== undefined) {
                updateData.parentId = item.parentId;
            }

            batch.update(docRef, updateData);
        });

        await batch.commit();

        return NextResponse.json({ success: true, count: items.length });
    } catch (error: any) {
        console.error("Error reordering equipment:", error);
        return NextResponse.json({
            error: "Failed to reorder equipment",
            details: error.message
        }, { status: 500 });
    }
}
