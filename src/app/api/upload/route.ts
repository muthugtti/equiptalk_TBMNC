import { NextRequest, NextResponse } from "next/server";
import { bucket } from "@/lib/storage";
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const equipmentId = formData.get("equipmentId") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        if (!equipmentId) {
            return NextResponse.json({ error: "No equipment ID provided" }, { status: 400 });
        }

        if (equipmentId === "new") {
            return NextResponse.json({ error: "Cannot upload files for unsaved equipment. Please save first." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${equipmentId}/${uuidv4()}-${file.name}`;
        const fileUpload = bucket.file(filename);

        await fileUpload.save(buffer, {
            metadata: {
                contentType: file.type,
            },
        });

        // Make the file public (optional, depends on security requirements. 
        // For now, let's assume signed URLs or public buckets. 
        // If the bucket is not public, we might need a signed URL.
        // Let's assume we want to return the public URL if accessible or just the path).

        // For this demo, let's return the storage path.
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

        return NextResponse.json({ url: publicUrl, filename }, { status: 201 });

    } catch (error: any) {
        console.error("Error uploading file:", error);
        return NextResponse.json({
            error: "Upload failed",
            details: error.message || "Unknown error"
        }, { status: 500 });
    }
}
