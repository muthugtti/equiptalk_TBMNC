import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const equipment = await prisma.equipment.findUnique({
            where: { id },
            include: {
                documents: true
            }
        });

        if (!equipment) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }

        return NextResponse.json(equipment);
    } catch (error) {
        console.error("Error fetching equipment:", error);
        return NextResponse.json({ error: "Failed to fetch equipment" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        // Exclude fields that shouldn't be updated or don't exist in Prisma model flatly
        const { id: _, documents, createdAt, updatedAt, ...updateData } = body;

        const updatedEquipment = await prisma.equipment.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(updatedEquipment);
    } catch (error) {
        console.error("Error updating equipment:", error);
        return NextResponse.json({ error: "Failed to update equipment" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.equipment.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting equipment:", error);
        return NextResponse.json({ error: "Failed to delete equipment" }, { status: 500 });
    }
}
