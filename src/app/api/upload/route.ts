import { NextRequest, NextResponse } from "next/server";
import { getStorageBucket } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from 'uuid';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', // Images
    'application/pdf', 'text/plain', // Documents
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // DOCX
];

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const equipmentId = formData.get("equipmentId") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "File type not supported" }, { status: 400 });
        }

        if (!equipmentId) {
            return NextResponse.json({ error: "No equipment ID provided" }, { status: 400 });
        }

        if (equipmentId === "new") {
            return NextResponse.json({ error: "Cannot upload files for unsaved equipment. Please save first." }, { status: 400 });
        }

        const bucket = await getStorageBucket();
        const buffer = Buffer.from(await file.arrayBuffer());

        // Sanitize filename
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `equipment/${equipmentId}/${uuidv4()}-${safeName}`;
        const fileUpload = bucket.file(filename);

        // Generated a download token (Firebase style)
        const downloadToken = uuidv4();

        await fileUpload.save(buffer, {
            metadata: {
                contentType: file.type,
                metadata: {
                    equipmentId: equipmentId,
                    originalName: file.name,
                    firebaseStorageDownloadTokens: downloadToken
                }
            },
        });

        // Construct the standard Firebase Storage URL
        // Format: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media&token=<token>
        const encodedPath = encodeURIComponent(filename);
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

        return NextResponse.json({
            url: publicUrl,
            filename: filename,
            size: file.size,
            type: file.type
        }, { status: 201 });

    } catch (error: any) {
        console.error("Error uploading file:", error);
        return NextResponse.json({
            error: "Upload failed",
            details: error.message || "Unknown error"
        }, { status: 500 });
    }
}
