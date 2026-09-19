import { decodePDFText } from "unpdf";

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedDocument {
  filename: string;
  mimeType: string;
  pageCount: number;
  pages: ParsedPage[];
  totalCharacters: number;
}

/**
 * Extracts text from PDF, TXT, or Markdown buffers in a serverless-friendly manner.
 */
export async function parseDocumentBuffer(
  buffer: Buffer | Uint8Array,
  filename: string,
  mimeType: string
): Promise<ParsedDocument> {
  const isPdf =
    filename.toLowerCase().endsWith(".pdf") || mimeType.toLowerCase().includes("pdf");

  if (isPdf) {
    try {
      const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const arrayBuffer = uint8.buffer.slice(
        uint8.byteOffset,
        uint8.byteOffset + uint8.byteLength
      ) as ArrayBuffer;

      const pdfContent = await decodePDFText(arrayBuffer, { mergePages: false });

      const pagesArray: string[] = Array.isArray(pdfContent.text)
        ? pdfContent.text
        : [pdfContent.text || ""];

      const pages: ParsedPage[] = pagesArray
        .map((pageText, idx) => ({
          pageNumber: idx + 1,
          text: (pageText || "").trim(),
        }))
        .filter((p) => p.text.length > 0);

      const totalChars = pages.reduce((acc, p) => acc + p.text.length, 0);

      return {
        filename,
        mimeType: "application/pdf",
        pageCount: Math.max(1, pdfContent.totalPages || pages.length),
        pages:
          pages.length > 0
            ? pages
            : [{ pageNumber: 1, text: "No extractable text found in PDF." }],
        totalCharacters: totalChars,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse PDF "${filename}": ${errorMessage}`);
    }
  }

  // Handle plain text and markdown
  const textContent = buffer.toString();
  return {
    filename,
    mimeType: mimeType || "text/plain",
    pageCount: 1,
    pages: [
      {
        pageNumber: 1,
        text: textContent.trim(),
      },
    ],
    totalCharacters: textContent.length,
  };
}
