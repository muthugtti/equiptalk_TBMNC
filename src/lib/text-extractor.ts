import { extractText, getDocumentProxy } from "unpdf";

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
