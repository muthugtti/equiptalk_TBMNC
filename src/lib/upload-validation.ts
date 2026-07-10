// Pure, dependency-free validation for the file-upload route.
//
// This logic used to live inline in `src/app/api/upload/route.ts`, where it
// could not be unit-tested without booting the Firebase Admin SDK. It is
// extracted here as a pure function so `tests/upload-validation.test.ts` can
// exercise exactly which files are accepted vs. rejected.
//
// The original bug ("certain documents aren't uploading") came from deciding
// acceptance *solely* on the browser-supplied MIME type (`File.type`). That
// value is unreliable — browsers report "" or "application/octet-stream" for
// perfectly valid files when the OS has no handler registered for the
// extension. The fix: when the MIME type is missing or generic, fall back to
// the filename extension, and widen the allowlist to the document types users
// actually upload.

// Max file size: 10MB
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Accepted MIME types.
export const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', // Images
    'application/pdf', 'text/plain', // Documents
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'text/markdown', 'text/csv', // Text-based docs browsers often mislabel
    'application/msword', // Legacy .doc
];

// Extensions we accept when the browser-supplied MIME type is missing or
// generic. This is the security gate for untyped uploads: an unknown type is
// only allowed through if the filename extension is one we recognize, so an
// arbitrary binary reporting "application/octet-stream" is still rejected.
export const ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
    'pdf', 'txt', 'docx', 'md', 'csv', 'doc',
];

// MIME values that carry no real information about the file. When we see one of
// these we defer the decision to the filename extension.
const GENERIC_TYPES = new Set(['', 'application/octet-stream']);

export interface UploadCandidate {
    /** Browser-reported MIME type (`File.type`), which may be "" for some files. */
    type: string;
    /** File size in bytes. */
    size: number;
    /** The equipmentId form field (may be null/"new"). */
    equipmentId: string | null;
    /** Original filename; used to recover the type when `type` is missing/generic. */
    name?: string | null;
}

export type UploadValidation =
    | { ok: true }
    | { ok: false; status: number; error: string };

/** Lowercased extension of a filename, or "" if there isn't a usable one. */
export function extensionOf(name?: string | null): string {
    if (!name) return "";
    const dot = name.lastIndexOf(".");
    if (dot < 0 || dot === name.length - 1) return "";
    return name.slice(dot + 1).toLowerCase();
}

/**
 * Decide whether an upload candidate is allowed, mirroring the checks the route
 * applies before it touches storage. Ownership (isEquipmentOwnedBy) is NOT
 * covered here — that requires Firestore and is enforced separately in the route.
 */
export function validateUpload(file: UploadCandidate): UploadValidation {
    if (file.size > MAX_FILE_SIZE) {
        return { ok: false, status: 400, error: "File size exceeds 10MB limit" };
    }

    const ext = extensionOf(file.name);
    const typeAllowed = ALLOWED_TYPES.includes(file.type);
    const extAllowed = ALLOWED_EXTENSIONS.includes(ext);
    // Accept when the MIME type is recognized, OR when it's missing/generic but
    // the filename extension is one we support. A non-generic-but-unlisted type
    // with an allowed extension is also accepted, since the extension is what we
    // ultimately store and extract against.
    const accepted =
        typeAllowed || extAllowed || (GENERIC_TYPES.has(file.type) && extAllowed);

    if (!accepted) {
        return { ok: false, status: 400, error: "File type not supported" };
    }

    if (!file.equipmentId) {
        return { ok: false, status: 400, error: "No equipment ID provided" };
    }

    if (file.equipmentId === "new") {
        return {
            ok: false,
            status: 400,
            error: "Cannot upload files for unsaved equipment. Please save first.",
        };
    }

    return { ok: true };
}

/**
 * Which extraction path (if any) a file should take for RAG indexing.
 *
 * The upload route used to gate extraction on `file.type` alone, so a document
 * that was rescued by its extension (empty/generic MIME type) would upload but
 * never get embedded — searchable-in-chat quietly broke. Resolving the kind by
 * type OR extension keeps the extraction gate in lockstep with what
 * validateUpload lets through.
 *
 * Returns null for files we don't extract (images, and legacy binary .doc,
 * which mammoth can't read — those are stored but not embedded).
 */
export type ExtractionKind = "pdf" | "text" | "docx" | null;

const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/csv"]);
const TEXT_EXTENSIONS = new Set(["txt", "md", "csv"]);
const DOCX_TYPE =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function resolveExtractionKind(file: { type: string; name?: string | null }): ExtractionKind {
    const ext = extensionOf(file.name);

    if (file.type === "application/pdf" || ext === "pdf") return "pdf";
    if (file.type === DOCX_TYPE || ext === "docx") return "docx";
    if (TEXT_TYPES.has(file.type) || TEXT_EXTENSIONS.has(ext)) return "text";
    return null;
}
