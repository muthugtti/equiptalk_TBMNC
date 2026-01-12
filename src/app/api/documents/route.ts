import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, url, type, equipmentId } = body;

        if (!name || !url || !equipmentId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const document = await prisma.document.create({
            data: {
                name,
                url,
                type: type || "document",
                equipmentId
            }
        });

        return NextResponse.json(document, { status: 201 });
    } catch (error) {
        console.error("Error creating document:", error);
        return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
    }
}
