import { NextRequest, NextResponse } from "next/server";
import { getStorageBucket, getDb } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from 'uuid';
import { extractTextFromPdf } from '@/lib/text-extractor';
import { getEmbedding, chunkText } from '@/lib/gemini';
import { requireAuth, isEquipmentOwnedBy } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { invalidateEquipmentCache } from "@/lib/semantic-cache";

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', // Images
    'application/pdf', 'text/plain', // Documents
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // DOCX
];
// Uploads trigger embedding calls and storage writes — cap abuse per user per window.
const UPLOAD_RATE_LIMIT = { maxAttempts: 20, windowMs: 15 * 60 * 1000, lockoutMs: 5 * 60 * 1000 };

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`upload:${auth.uid}`, true, UPLOAD_RATE_LIMIT);
    if (!rateLimit.allowed) {
        const retryAfterSec = Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000);
        return NextResponse.json(
            { error: "Too many uploads. Please slow down." },
            { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
        );
    }

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

        // Don't let a user upload files / RAG chunks against another account's
        // equipment. Reject foreign or non-existent equipmentIds.
        if (!(await isEquipmentOwnedBy(equipmentId, auth.uid))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

        // Extract, chunk, embed and save text for PDFs and plain text files
        if (file.type === 'application/pdf' || file.type === 'text/plain') {
            try {
                const text = file.type === 'application/pdf'
                    ? await extractTextFromPdf(buffer)
                    : buffer.toString('utf-8');
                if (text) {
                    const db = await getDb();
                    const docRef = await db.collection('equipment_docs_text').add({
                        equipmentId,
                        createdBy: auth.uid,
                        fileName: file.name,
                        storagePath: filename,
                        text,
                        uploadedAt: new Date().toISOString()
                    });
                    // Chunk + embed for RAG (committed in small batches to stay under
                    // Firestore's per-request size limit, since embedding vectors are large)
                    const chunks = chunkText(text);
                    const BATCH_SIZE = 20;
                    let batch = db.batch();
                    let opsInBatch = 0;
                    for (let i = 0; i < chunks.length; i++) {
                        if (i > 0) await new Promise(r => setTimeout(r, 200));
                        const embedding = await getEmbedding(chunks[i]);
                        const chunkRef = db.collection('equipment_doc_chunks').doc();
                        batch.set(chunkRef, {
                            equipmentId,
                            createdBy: auth.uid,
                            docId: docRef.id,
                            fileName: file.name,
                            text: chunks[i],
                            embedding,
                            chunkIndex: i,
                            createdAt: new Date().toISOString()
                        });
                        opsInBatch++;
                        if (opsInBatch === BATCH_SIZE) {
                            await batch.commit();
                            batch = db.batch();
                            opsInBatch = 0;
                        }
                    }
                    if (opsInBatch > 0) await batch.commit();
                    // New document changes what the AI knows — invalidate cached answers
                    invalidateEquipmentCache(equipmentId).catch(e =>
                        console.error("[Upload] Cache invalidation failed:", e)
                    );
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
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
