import { test } from "node:test";
import assert from "node:assert/strict";
import {
    validateUpload,
    resolveExtractionKind,
    MAX_FILE_SIZE,
    ALLOWED_TYPES,
} from "../src/lib/upload-validation.ts";

const DOCX_TYPE =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// These tests cover the file-upload gatekeeping that decides whether a document
// reaches storage. The reported bug — "certain documents aren't uploading" — is
// entirely a property of validateUpload: acceptance is decided solely on the
// browser-supplied MIME type (`File.type`), which is unreliable. validateUpload
// is pure, so we can enumerate exactly which files pass and which are rejected
// with no Firebase/Gemini involved.
//
// The suite is split in two:
//   1. CHARACTERIZATION — locks in behavior we intend to keep (size limit,
//      equipmentId rules, and the security boundary for unknown files).
//   2. REGRESSION — documents that previously failed to upload because
//      acceptance was decided on MIME type alone. The fix (extension fallback in
//      validateUpload) makes these pass; they guard against the bug returning.

const OK_EQUIP = "equip_123";

/* ------------------------------------------------------------------ */
/* 1. Characterization — behavior we want to keep (should pass)        */
/* ------------------------------------------------------------------ */

test("accepts a normal PDF with a well-formed MIME type", () => {
    const r = validateUpload({ type: "application/pdf", size: 2_000_000, equipmentId: OK_EQUIP });
    assert.deepEqual(r, { ok: true });
});

test("accepts a plain-text file", () => {
    const r = validateUpload({ type: "text/plain", size: 1024, equipmentId: OK_EQUIP });
    assert.equal(r.ok, true);
});

test("accepts a DOCX file (present in the allowlist)", () => {
    const r = validateUpload({
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 50_000,
        equipmentId: OK_EQUIP,
    });
    assert.equal(r.ok, true);
});

test("rejects a file over the 10MB limit with a 400 and size message", () => {
    const r = validateUpload({ type: "application/pdf", size: MAX_FILE_SIZE + 1, equipmentId: OK_EQUIP });
    assert.equal(r.ok, false);
    assert.equal(r.status, 400);
    assert.match(r.error, /10MB/);
});

/* ------------------------------------------------------------------ */
/* Size limit — pin down the exact boundary, not just "too big fails". */
/* The check is `size > MAX_FILE_SIZE`, so MAX_FILE_SIZE itself passes  */
/* and the unit is binary MiB (10 * 1024 * 1024), not decimal MB.      */
/* ------------------------------------------------------------------ */

test("the limit is 10 MiB = 10,485,760 bytes (binary, not decimal 10,000,000)", () => {
    assert.equal(MAX_FILE_SIZE, 10_485_760);
});

test("a file exactly at the limit is accepted (boundary is inclusive)", () => {
    const r = validateUpload({ type: "application/pdf", size: MAX_FILE_SIZE, equipmentId: OK_EQUIP, name: "manual.pdf" });
    assert.equal(r.ok, true, "size === MAX_FILE_SIZE must pass; the check is `>` not `>=`");
});

test("one byte over the limit is rejected", () => {
    const r = validateUpload({ type: "application/pdf", size: MAX_FILE_SIZE + 1, equipmentId: OK_EQUIP, name: "manual.pdf" });
    assert.equal(r.ok, false);
});

test("a 10,000,000-byte file passes (below the binary limit despite being '10MB' decimal)", () => {
    const r = validateUpload({ type: "application/pdf", size: 10_000_000, equipmentId: OK_EQUIP, name: "manual.pdf" });
    assert.equal(r.ok, true);
});

test("a zero-byte file is not rejected on size (no minimum is enforced)", () => {
    // Characterization: there is no lower bound. An empty file uploads, extracts
    // to "", and is skipped by the `if (text)` guard in the route — stored, not embedded.
    const r = validateUpload({ type: "application/pdf", size: 0, equipmentId: OK_EQUIP, name: "empty.pdf" });
    assert.equal(r.ok, true);
});

test("the size limit applies to every accepted type, images included", () => {
    // One shared MAX_FILE_SIZE — no per-type override anywhere.
    for (const type of ALLOWED_TYPES) {
        const over = validateUpload({ type, size: MAX_FILE_SIZE + 1, equipmentId: OK_EQUIP });
        assert.equal(over.ok, false, `${type} should be rejected over the limit`);
        const at = validateUpload({ type, size: MAX_FILE_SIZE, equipmentId: OK_EQUIP });
        assert.equal(at.ok, true, `${type} should be accepted at the limit`);
    }
});

test("rejects when equipmentId is missing", () => {
    const r = validateUpload({ type: "application/pdf", size: 1000, equipmentId: null });
    assert.equal(r.ok, false);
    assert.match(r.error, /No equipment ID/);
});

test("rejects the sentinel 'new' equipmentId (unsaved equipment)", () => {
    const r = validateUpload({ type: "application/pdf", size: 1000, equipmentId: "new" });
    assert.equal(r.ok, false);
    assert.match(r.error, /save first/i);
});

test("size limit is checked before type (a huge unsupported file reports size)", () => {
    // Ordering matters for the user-facing message; lock it in.
    const r = validateUpload({ type: "application/zip", size: MAX_FILE_SIZE + 1, equipmentId: OK_EQUIP });
    assert.equal(r.ok, false);
    assert.match(r.error, /10MB/);
});

/* ------------------------------------------------------------------ */
/* Security boundary — the extension fallback must NOT open the door   */
/* to arbitrary binaries. These are characterization tests too.        */
/* ------------------------------------------------------------------ */

test("rejects an executable with an empty MIME type (unknown extension)", () => {
    // The whole point of the extension fallback is that it only rescues files we
    // recognize. An .exe with no MIME type must still be turned away.
    const r = validateUpload({ type: "", size: 500_000, equipmentId: OK_EQUIP, name: "installer.exe" });
    assert.equal(r.ok, false);
    assert.match(r.error, /not supported/);
});

test("rejects an empty MIME type with no filename extension at all", () => {
    const r = validateUpload({ type: "", size: 1000, equipmentId: OK_EQUIP, name: "READMEnoext" });
    assert.equal(r.ok, false);
    assert.match(r.error, /not supported/);
});

/* ------------------------------------------------------------------ */
/* 2. Regression — documents that previously failed to upload because  */
/*    acceptance was decided on MIME type alone. The extension fallback */
/*    makes these pass; they guard against the bug returning.          */
/* ------------------------------------------------------------------ */

test("regression: PDF with an empty MIME type uploads (rescued by .pdf extension)", () => {
    // Browsers/OSes frequently report File.type === "" when there is no
    // registered handler for the extension. A real PDF must still upload.
    const r = validateUpload({ type: "", size: 500_000, equipmentId: OK_EQUIP, name: "datasheet.pdf" });
    assert.equal(r.ok, true, "a real PDF with an empty MIME type should be allowed to upload");
});

test("regression: document reported as application/octet-stream uploads (rescued by extension)", () => {
    // A very common generic fallback type for documents dragged in from certain
    // OSes / browsers. Previously rejected as "File type not supported".
    const r = validateUpload({
        type: "application/octet-stream",
        size: 500_000,
        equipmentId: OK_EQUIP,
        name: "service-manual.pdf",
    });
    assert.equal(r.ok, true, "a generic octet-stream document with a known extension should upload");
});

test("regression: Markdown (.md, text/markdown) manual uploads", () => {
    const r = validateUpload({ type: "text/markdown", size: 12_000, equipmentId: OK_EQUIP, name: "guide.md" });
    assert.equal(r.ok, true, "a Markdown document should be accepted");
});

test("regression: CSV (.csv, text/csv) parts list uploads", () => {
    const r = validateUpload({ type: "text/csv", size: 8_000, equipmentId: OK_EQUIP, name: "parts.csv" });
    assert.equal(r.ok, true, "a CSV document should be accepted");
});

test("regression: legacy Word .doc (application/msword) uploads", () => {
    const r = validateUpload({ type: "application/msword", size: 60_000, equipmentId: OK_EQUIP, name: "legacy.doc" });
    assert.equal(r.ok, true, "a legacy .doc document should be accepted");
});

/* ------------------------------------------------------------------ */
/* Guard: the allowlist stays internally consistent                    */
/* ------------------------------------------------------------------ */

test("allowlist contains no duplicate entries", () => {
    assert.equal(new Set(ALLOWED_TYPES).size, ALLOWED_TYPES.length);
});

/* ------------------------------------------------------------------ */
/* 3. Extraction gate — a file that uploads must also be routed to the */
/*    right text-extraction path, or it uploads but is never searchable.*/
/*    resolveExtractionKind is what keeps the gate in step with what    */
/*    validateUpload lets through.                                      */
/* ------------------------------------------------------------------ */

test("resolves a well-typed PDF to the pdf extractor", () => {
    assert.equal(resolveExtractionKind({ type: "application/pdf", name: "m.pdf" }), "pdf");
});

test("resolves a PDF with an empty MIME type to the pdf extractor (by extension)", () => {
    // The exact bug: this file now uploads AND gets embedded, not just stored.
    assert.equal(resolveExtractionKind({ type: "", name: "datasheet.pdf" }), "pdf");
});

test("resolves an octet-stream PDF to the pdf extractor (by extension)", () => {
    assert.equal(
        resolveExtractionKind({ type: "application/octet-stream", name: "service-manual.pdf" }),
        "pdf",
    );
});

test("resolves plain text, Markdown and CSV to the text extractor", () => {
    assert.equal(resolveExtractionKind({ type: "text/plain", name: "notes.txt" }), "text");
    assert.equal(resolveExtractionKind({ type: "text/markdown", name: "guide.md" }), "text");
    assert.equal(resolveExtractionKind({ type: "", name: "parts.csv" }), "text");
});

test("resolves DOCX (by type and by extension) to the docx extractor", () => {
    assert.equal(resolveExtractionKind({ type: DOCX_TYPE, name: "spec.docx" }), "docx");
    assert.equal(resolveExtractionKind({ type: "application/octet-stream", name: "spec.docx" }), "docx");
});

test("does not route images to any extractor", () => {
    assert.equal(resolveExtractionKind({ type: "image/png", name: "photo.png" }), null);
});

test("does not route legacy binary .doc to an extractor (mammoth can't read it)", () => {
    // .doc still uploads (it's in the allowlist) but is stored-only, not embedded.
    assert.equal(resolveExtractionKind({ type: "application/msword", name: "old.doc" }), null);
});
