import { NextRequest, NextResponse } from "next/server";
import { getStorageBucket, getDb } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from 'uuid';
import { extractTextFromPdf } from '@/lib/text-extractor';
import { getEmbedding, chunkText } from '@/lib/gemini';

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

        // Extract, chunk, embed and save text for PDFs
        if (file.type === 'application/pdf') {
            try {
                const text = await extractTextFromPdf(buffer);
                if (text) {
                    const db = await getDb();
                    const docRef = await db.collection('equipment_docs_text').add({
                        equipmentId,
                        fileName: file.name,
                        storagePath: filename,
                        text,
                        uploadedAt: new Date().toISOString()
                    });
                    console.log(`[Upload] Extracted ${text.length} chars from ${file.name}`);

                    // Chunk + embed for RAG
                    const chunks = chunkText(text);
                    console.log(`[Upload] Embedding ${chunks.length} chunks for RAG`);
                    const batch = db.batch();
                    for (let i = 0; i < chunks.length; i++) {
                        const embedding = await getEmbedding(chunks[i]);
                        const chunkRef = db.collection('equipment_doc_chunks').doc();
                        batch.set(chunkRef, {
                            equipmentId,
                            docId: docRef.id,
                            fileName: file.name,
                            text: chunks[i],
                            embedding,
                            chunkIndex: i,
                            createdAt: new Date().toISOString()
                        });
                    }
                    await batch.commit();
                    console.log(`[Upload] Stored ${chunks.length} embedded chunks`);
                }
            } catch (extractError) {
                console.error("[Upload] Text extraction/embedding failed:", extractError);
                // Don't fail the upload if embedding fails
            }
        }

        // Construct the standard Firebase Storage URL
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
            error: `Upload failed: ${error.message}`,
            details: error.stack
        }, { status: 500 });
    }
}
