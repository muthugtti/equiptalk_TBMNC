import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    try {
        const db = await getDb();
        const equipmentRef = db.collection('equipment');
        const snapshot = await equipmentRef.orderBy('updatedAt', 'desc').get();

        const equipment = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ equipment });
    } catch (error: any) {
        console.error("Error fetching equipment:", error);
        return NextResponse.json({
            error: "Failed to fetch equipment",
            details: error.message
        }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    console.log("Starting equipment creation POST request");

    // Log environment state (safe values only)
    console.log("Environment check:", {
        nodeEnv: process.env.NODE_ENV,
        hasProjectId: !!(process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID),
        hasStorageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });

    try {
        let db;
        try {
            console.log("Attempting to get DB instance...");
            db = await getDb();
            console.log("DB instance retrieved successfully");
        } catch (dbError: any) {
            console.error("Failed to get DB instance:", dbError);
            return NextResponse.json({
                error: "Database connection failed",
                details: dbError.message
            }, { status: 500 });
        }

        let body;
        try {
            body = await req.json();
        } catch (e) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { name, type, model, serialNumber, status, organizationId } = body;

        if (!name || !type || !organizationId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Generate slug
        let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        // Check for existing slug
        const existingSnapshot = await db.collection('equipment')
            .where('slug', '==', slug)
            .limit(1)
            .get();

        if (!existingSnapshot.empty) {
            // Add random suffix if slug exists
            slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
        }

        const equipmentData = {
            name,
            type,
            model: model || "",
            serialNumber: serialNumber || "",
            status: status || "OPERATIONAL",
            organizationId,
            slug,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await db.collection('equipment').add(equipmentData);

        return NextResponse.json({
            id: docRef.id,
            ...equipmentData
        }, { status: 201 });
    } catch (error: any) {
        console.error("Error creating equipment:", error);
        return NextResponse.json({
            error: "Failed to create equipment",
            details: error.message || "Unknown error"
        }, { status: 500 });
    }
}
