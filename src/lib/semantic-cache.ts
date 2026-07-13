import { Index } from '@upstash/vector';

// Lazily construct the Upstash client. Constructing it at module load with
// `new Index({ url: undefined!, token: undefined! })` THROWS when the env vars
// are absent (e.g. not provisioned in the deployed runtime), which would crash
// the entire route module that imports this file — surfacing as a raw
// "Internal Server Error" before any handler try/catch can run. Init lazily and
// degrade gracefully instead: if the cache isn't configured, callers just skip
// it (semantic cache is a best-effort optimization, never a correctness path).
let cachedIndex: Index | null = null;
let indexInitAttempted = false;

function getIndex(): Index | null {
    if (indexInitAttempted) return cachedIndex;
    indexInitAttempted = true;
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
    if (!url || !token) {
        console.warn('[SemanticCache] UPSTASH_VECTOR_REST_URL/TOKEN not set — semantic cache disabled.');
        return null;
    }
    try {
        cachedIndex = new Index({ url, token });
    } catch (err) {
        console.error('[SemanticCache] Failed to initialize Upstash index:', err);
        cachedIndex = null;
    }
    return cachedIndex;
}

const SIMILARITY_THRESHOLD = 0.92;
// gemini-embedding-001 outputs 3072 dims; Upstash index is 1536
const UPSTASH_DIMS = 1536;

function truncate(embedding: number[]): number[] {
    return embedding.slice(0, UPSTASH_DIMS);
}

export async function checkSemanticCache(
    equipmentId: string,
    embedding: number[]
): Promise<string | null> {
    const index = getIndex();
    if (!index) return null;
    try {
        const results = await index.namespace(equipmentId).query({
            vector: truncate(embedding),
            topK: 1,
            includeMetadata: true,
        });
        const top = results[0];
        if (top?.score >= SIMILARITY_THRESHOLD && top.metadata?.answer) {
            return top.metadata.answer as string;
        }
    } catch (err) {
        console.error('[SemanticCache] Check failed:', err);
    }
    return null;
}

export async function storeSemanticCache(
    equipmentId: string,
    embedding: number[],
    question: string,
    answer: string
): Promise<void> {
    const index = getIndex();
    if (!index) return;
    try {
        await index.namespace(equipmentId).upsert({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            vector: truncate(embedding),
            metadata: { question, answer, cachedAt: new Date().toISOString() },
        });
    } catch (err) {
        console.error('[SemanticCache] Store failed:', err);
    }
}

// Called on new document upload to prevent stale answers
export async function invalidateEquipmentCache(equipmentId: string): Promise<void> {
    const index = getIndex();
    if (!index) return;
    try {
        await index.namespace(equipmentId).reset();
    } catch (err) {
        console.error('[SemanticCache] Invalidation failed:', err);
    }
}

// Negative examples (answers users marked unhelpful) live in a sibling namespace
// so they can be similarity-searched without polluting the answer cache.
const NEG_NAMESPACE = (equipmentId: string) => `${equipmentId}::neg`;
// Looser than the cache-hit threshold: we want to catch *related* bad answers,
// not just near-identical questions.
const NEGATIVE_MATCH_THRESHOLD = 0.85;

/**
 * Drop the cached answer for a question the user marked unhelpful, so it is not
 * replayed. Finds the closest cached entry to the question embedding and, if it
 * clears the cache-hit threshold (i.e. it's the entry that would be served),
 * deletes it. Best-effort — cache is never a correctness path.
 */
export async function invalidateCachedAnswer(
    equipmentId: string,
    embedding: number[]
): Promise<void> {
    const index = getIndex();
    if (!index) return;
    try {
        const results = await index.namespace(equipmentId).query({
            vector: truncate(embedding),
            topK: 1,
            includeMetadata: false,
        });
        const top = results[0];
        if (top && top.score >= SIMILARITY_THRESHOLD) {
            await index.namespace(equipmentId).delete(top.id as string);
        }
    } catch (err) {
        console.error('[SemanticCache] invalidateCachedAnswer failed:', err);
    }
}

/**
 * Record a question/answer pair the user flagged as unhelpful, so future similar
 * questions can steer away from the same mistake.
 */
export async function recordNegativeExample(
    equipmentId: string,
    embedding: number[],
    question: string,
    answer: string
): Promise<void> {
    const index = getIndex();
    if (!index) return;
    try {
        await index.namespace(NEG_NAMESPACE(equipmentId)).upsert({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            vector: truncate(embedding),
            // Cap the stored answer so a single flag can't bloat the vector store.
            metadata: { question, answer: answer.slice(0, 1200), flaggedAt: new Date().toISOString() },
        });
    } catch (err) {
        console.error('[SemanticCache] recordNegativeExample failed:', err);
    }
}

/**
 * Retrieve previously-flagged unhelpful answers whose question resembles the
 * current one, so the chat route can tell the model what to avoid.
 */
export async function getSimilarNegatives(
    equipmentId: string,
    embedding: number[],
    limit = 3
): Promise<Array<{ question: string; answer: string }>> {
    const index = getIndex();
    if (!index) return [];
    try {
        const results = await index.namespace(NEG_NAMESPACE(equipmentId)).query({
            vector: truncate(embedding),
            topK: limit,
            includeMetadata: true,
        });
        return results
            .filter(r => r.score >= NEGATIVE_MATCH_THRESHOLD && r.metadata?.answer)
            .map(r => ({
                question: (r.metadata?.question as string) ?? "",
                answer: r.metadata!.answer as string,
            }));
    } catch (err) {
        console.error('[SemanticCache] getSimilarNegatives failed:', err);
        return [];
    }
}
