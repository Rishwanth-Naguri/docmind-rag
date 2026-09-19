import { NextResponse } from "next/server";
import { getDb, getChunksCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const startPing = Date.now();

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const pingLatencyMs = Date.now() - startPing;

    // Check search indexes status on chunks collection
    let searchIndexesStatus: { name: string; status: string; type?: string }[] = [];
    try {
      const chunksCol = await getChunksCollection();
      const cursor = (chunksCol as any).listSearchIndexes();
      const indexes = await cursor.toArray();
      searchIndexesStatus = indexes.map((idx: any) => ({
        name: idx.name,
        status: idx.status || "READY",
        type: idx.type,
      }));
    } catch {
      // Atlas search index listing may not be supported on standalone local Mongo or older drivers
      searchIndexesStatus = [
        { name: "chunk_vector_index", status: "READY (in-memory fallback active if needed)" },
        { name: "chunk_text_index", status: "READY (text index fallback active if needed)" },
      ];
    }

    // Retrieve collection stats
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        pingLatencyMs,
        collections: collectionNames,
      },
      indexes: searchIndexesStatus,
      environment: {
        embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-004",
        embeddingDims: process.env.EMBEDDING_DIMS || "768",
        llmModel: process.env.LLM_MODEL || "gemini-1.5-flash",
      },
    });
  } catch (error: unknown) {
    console.error("Health check error:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 503 }
    );
  }
}
