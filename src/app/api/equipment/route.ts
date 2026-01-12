import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
    try {
        const equipment = await prisma.equipment.findMany({
            orderBy: {
                updatedAt: 'desc'
            }
        });

        return NextResponse.json({ equipment });
    } catch (error) {
        console.error("Error fetching equipment:", error);
        return NextResponse.json({ error: "Failed to fetch equipment" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, type, model, serialNumber, status, organizationId } = body;

        if (!name || !type || !organizationId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Slug generation
        let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        // Ensure unique slug
        const existing = await prisma.equipment.findUnique({
            where: { slug }
        });

        if (existing) {
            slug = `${slug}-${uuidv4().slice(0, 4)}`;
        }

        const newEquipment = await prisma.equipment.create({
            data: {
                name,
                type,
                model: model || "",
                serialNumber: serialNumber || "",
                status: status || "OPERATIONAL",
                organizationId,
                slug,
            }
        });

        return NextResponse.json(newEquipment, { status: 201 });
    } catch (error) {
        console.error("Error creating equipment:", error);
        return NextResponse.json({ error: "Failed to create equipment" }, { status: 500 });
    }
}
