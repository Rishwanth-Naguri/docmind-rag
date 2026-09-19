import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionId } from "@/lib/memory/session";
import { getDocumentsCollection, getChunksCollection } from "@/lib/mongodb";
import { parseDocumentBuffer } from "@/lib/ingestion/parser";
import { chunkPages } from "@/lib/ingestion/chunker";
import { getAIProvider } from "@/lib/ai/provider";
import { isValidFileType, sanitizeFilename } from "@/lib/validations";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { DocumentRecord, ChunkRecord } from "@/lib/types/database";

export const maxDuration = 60; // Allow sufficient time for batch embedding

export async function POST(req: NextRequest) {
  try {
    const sessionId = await getSessionId();
    const clientIp = getClientIp(req);

    // Rate limiting: 10 uploads per minute per IP/session
    const rateLimit = checkRateLimit(`upload:${clientIp}:${sessionId}`, {
      windowMs: 60 * 1000,
      maxRequests: 10,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Upload rate limit exceeded. Please wait a minute." },
        { status: 429 }
      );
    }

    const docsCol = await getDocumentsCollection();
    const maxDocs = parseInt(process.env.MAX_DOCS_PER_SESSION || "20", 10);
    const existingDocCount = await docsCol.countDocuments({ sessionId });

    if (existingDocCount >= maxDocs) {
      return NextResponse.json(
        { error: `Session document limit reached (${maxDocs} max). Please delete older documents.` },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const maxSizeBytes = parseInt(process.env.MAX_FILE_SIZE_BYTES || "5242880", 10); // 5 MB default
    const ai = getAIProvider();
    const chunksCol = await getChunksCollection();

    const uploadedRecords: DocumentRecord[] = [];

    for (const file of files) {
      if (file.size > maxSizeBytes) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds maximum allowed size of 5 MB.` },
          { status: 400 }
        );
      }

      const safeName = sanitizeFilename(file.name);
      if (!isValidFileType(safeName, file.type)) {
        return NextResponse.json(
          { error: `Unsupported file format for "${file.name}". Only PDF, TXT, and MD are supported.` },
          { status: 400 }
        );
      }

      // Initial document record
      const docRecord: DocumentRecord = {
        sessionId,
        filename: safeName,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        pageCount: 1,
        chunkCount: 0,
        status: "processing",
        createdAt: new Date(),
      };

      const docInsert = await docsCol.insertOne(docRecord);
      const documentId = docInsert.insertedId;
      docRecord._id = documentId;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 1. Parse document text & pages
        const parsed = await parseDocumentBuffer(buffer, safeName, file.type);

        // 2. Chunk text (~800 tokens, 100 overlap)
        const generatedChunks = chunkPages(parsed.pages, safeName);

        if (generatedChunks.length === 0) {
          throw new Error("No readable text could be extracted from document.");
        }

        // 3. Batch embed chunk texts
        const chunkTexts = generatedChunks.map((c) => c.text);
        const embeddings = await ai.embedTexts(chunkTexts);

        // 4. Create chunk records
        const chunkRecords: ChunkRecord[] = generatedChunks.map((chunk, idx) => ({
          documentId,
          sessionId,
          text: chunk.text,
          embedding: embeddings[idx] || [],
          metadata: chunk.metadata,
          createdAt: new Date(),
        }));

        if (chunkRecords.length > 0) {
          await chunksCol.insertMany(chunkRecords);
        }

        // 5. Update document status to ready
        await docsCol.updateOne(
          { _id: documentId },
          {
            $set: {
              status: "ready",
              pageCount: parsed.pageCount,
              chunkCount: generatedChunks.length,
            },
          }
        );

        docRecord.status = "ready";
        docRecord.pageCount = parsed.pageCount;
        docRecord.chunkCount = generatedChunks.length;
        uploadedRecords.push(docRecord);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await docsCol.updateOne(
          { _id: documentId },
          { $set: { status: "failed", errorMessage: errMsg } }
        );
        docRecord.status = "failed";
        docRecord.errorMessage = errMsg;
        uploadedRecords.push(docRecord);
      }
    }

    return NextResponse.json({
      success: true,
      documents: uploadedRecords,
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error while processing upload." },
      { status: 500 }
    );
  }
}
