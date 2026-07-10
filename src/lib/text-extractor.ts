import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

/**
 * Extract text from a PDF buffer.
 *
 * Uses `unpdf` (a maintained, serverless-friendly build of Mozilla's pdf.js)
 * instead of the abandoned `pdf-parse@1.1.1` (last published 2018), which is
 * a concern because this runs on untrusted user-uploaded files.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        return text;
    } catch (error) {
        console.error("Error parsing PDF:", error);
        throw new Error("Failed to extract text from PDF");
    }
}

/**
 * Extract text from a DOCX (Office Open XML) buffer using `mammoth`.
 *
 * `mammoth` reads the modern .docx zip container. It does NOT handle the legacy
 * binary .doc format — those files are stored but not embedded.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
    try {
        const { value } = await mammoth.extractRawText({ buffer });
        return value;
    } catch (error) {
        console.error("Error parsing DOCX:", error);
        throw new Error("Failed to extract text from DOCX");
    }
}
