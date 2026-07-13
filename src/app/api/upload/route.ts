import { NextRequest, NextResponse } from "next/server";
import { getStorageBucket, getDb } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from 'uuid';
import { extractTextFromPdf, extractTextFromDocx } from '@/lib/text-extractor';
import { getEmbeddings, chunkText, EMBED_BATCH_SIZE } from '@/lib/gemini';
import { requireAuth, isEquipmentOwnedBy } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { invalidateEquipmentCache } from "@/lib/semantic-cache";
import { validateUpload, resolveExtractionKind } from "@/lib/upload-validation";

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

        // Shared, unit-tested validation (see src/lib/upload-validation.ts).
        const validation = validateUpload({ type: file.type, size: file.size, equipmentId, name: file.name });
        if (!validation.ok) {
            return NextResponse.json({ error: validation.error }, { status: validation.status });
        }
        // validateUpload already rejects a null/empty equipmentId, but that check
        // lives behind a result object the compiler can't use to narrow the type.
        // This guard is unreachable at runtime and just tells TS the id is a
        // string for the ownership check and storage paths below.
        if (!equipmentId) {
            return NextResponse.json({ error: "No equipment ID provided" }, { status: 400 });
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

        // Extract, chunk, embed and save text for the document kinds we can read.
        // Resolve the kind by type OR filename extension so documents rescued by
        // their extension (empty/generic MIME type) still get indexed for RAG.
        const extractionKind = resolveExtractionKind({ type: file.type, name: file.name });
        if (extractionKind) {
            try {
                const text = extractionKind === 'pdf'
                    ? await extractTextFromPdf(buffer)
                    : extractionKind === 'docx'
                        ? await extractTextFromDocx(buffer)
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
                    // Chunk + embed for RAG. Embeddings are computed in batches
                    // (one API call per EMBED_BATCH_SIZE chunks) rather than one
                    // call per chunk — the per-chunk loop with pacing could run
                    // past the 60s request timeout on large PDFs and crash the
                    // upload. Firestore writes stay in small batches (20) to keep
                    // each commit under the transaction size limit.
                    const chunks = chunkText(text);
                    const FIRESTORE_BATCH_SIZE = 20;
                    for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
                        const slice = chunks.slice(start, start + EMBED_BATCH_SIZE);
                        const embeddings = await getEmbeddings(slice);

                        let batch = db.batch();
                        let opsInBatch = 0;
                        for (let j = 0; j < slice.length; j++) {
                            const chunkRef = db.collection('equipment_doc_chunks').doc();
                            batch.set(chunkRef, {
                                equipmentId,
                                createdBy: auth.uid,
                                docId: docRef.id,
                                fileName: file.name,
                                text: slice[j],
                                embedding: embeddings[j] ?? [],
                                chunkIndex: start + j,
                                createdAt: new Date().toISOString()
                            });
                            opsInBatch++;
                            if (opsInBatch === FIRESTORE_BATCH_SIZE) {
                                await batch.commit();
                                batch = db.batch();
                                opsInBatch = 0;
                            }
                        }
                        if (opsInBatch > 0) await batch.commit();

                        // Gentle pacing between embed batches to respect rate limits.
                        if (start + EMBED_BATCH_SIZE < chunks.length) {
                            await new Promise(r => setTimeout(r, 200));
                        }
                    }
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
