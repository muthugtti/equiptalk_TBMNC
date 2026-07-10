import { getDb } from "@/lib/firebase-admin";

// publicLinkId is a UUID v4 (36 chars, hyphens). Keep the matcher a little
// broader to tolerate legacy/regenerated tokens, but bounded to prevent abuse.
const LINK_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export interface PublicEquipment {
    id: string;
    data: Record<string, any>;
}

export function isValidLinkId(linkId: unknown): linkId is string {
    return typeof linkId === "string" && LINK_ID_RE.test(linkId);
}

/**
 * Resolve an equipment document by its public link token — but only if the
 * owner has explicitly enabled public access. Returns null otherwise so the
 * caller responds with a 404 (never revealing whether the token exists).
 *
 * Queries by the single `publicLinkId` field (Firestore auto-indexes single
 * fields, so no composite index is required); the enabled check is done in
 * code to avoid a composite index.
 */
export async function getPublicEquipment(linkId: string): Promise<PublicEquipment | null> {
    const db = await getDb();
    const snap = await db
        .collection("equipment")
        .where("publicLinkId", "==", linkId)
        .limit(1)
        .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data();
    if (data.isPublicAccessEnabled !== true) return null;

    return { id: doc.id, data };
}
