import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/docmind";
const dbName = process.env.MONGODB_DB_NAME || "docmind";
const embeddingDims = parseInt(process.env.EMBEDDING_DIMS || "768", 10);

async function setupIndexes() {
  console.log("Connecting to MongoDB Atlas...");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  console.log(`Connected to database: "${dbName}"`);

  const chunksCol = db.collection("chunks");
  const messagesCol = db.collection("messages");
  const documentsCol = db.collection("documents");
  const cacheCol = db.collection("semantic_cache");
  const sessionsCol = db.collection("sessions");

  // 1. Regular & TTL Indexes
  console.log("Setting up standard and TTL indexes...");

  await Promise.all([
    // documents: { sessionId: 1, createdAt: -1 }
    documentsCol.createIndex(
      { sessionId: 1, createdAt: -1 },
      { name: "idx_documents_session_created" }
    ),

    // chunks: { documentId: 1 } and { sessionId: 1 }
    chunksCol.createIndex({ documentId: 1 }, { name: "idx_chunks_documentId" }),
    chunksCol.createIndex({ sessionId: 1 }, { name: "idx_chunks_sessionId" }),

    // messages: { sessionId: 1, createdAt: 1 }
    messagesCol.createIndex(
      { sessionId: 1, createdAt: 1 },
      { name: "idx_messages_session_created" }
    ),

    // TTL index on semantic_cache: expires after 7 days
    cacheCol.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 7 * 24 * 60 * 60, name: "idx_semantic_cache_ttl" }
    ),

    // TTL index on sessions: expires after 30 days of inactivity
    sessionsCol.createIndex(
      { lastActiveAt: 1 },
      { expireAfterSeconds: 30 * 24 * 60 * 60, name: "idx_sessions_ttl" }
    ),
  ]);

  console.log("Standard and TTL indexes created successfully.");

  // 2. Atlas Vector Search Index on chunks
  const chunkVectorIndexDef = {
    name: process.env.CHUNK_VECTOR_INDEX || "chunk_vector_index",
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: "embedding",
          numDimensions: embeddingDims,
          similarity: "cosine",
        },
        {
          type: "filter",
          path: "sessionId",
        },
        {
          type: "filter",
          path: "documentId",
        },
      ],
    },
  };

  // 3. Atlas Search Full-Text Index on chunks.text
  const chunkTextIndexDef = {
    name: process.env.CHUNK_TEXT_INDEX || "chunk_text_index",
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          text: {
            type: "string",
            analyzer: "lucene.standard",
          },
          sessionId: {
            type: "token",
          },
          documentId: {
            type: "token",
          },
        },
      },
    },
  };

  // 4. Atlas Vector Search Index on semantic_cache
  const cacheVectorIndexDef = {
    name: process.env.CACHE_VECTOR_INDEX || "cache_vector_index",
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: "questionEmbedding",
          numDimensions: embeddingDims,
          similarity: "cosine",
        },
        {
          type: "filter",
          path: "sessionId",
        },
        {
          type: "filter",
          path: "docScopeKey",
        },
      ],
    },
  };

  console.log("\nDeploying Atlas Vector Search and Full-Text Search indexes...");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawChunks = chunksCol as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawCache = cacheCol as any;

    if (typeof rawChunks.createSearchIndex === "function") {
      try {
        console.log(`Creating search index: "${chunkVectorIndexDef.name}"...`);
        await rawChunks.createSearchIndex(chunkVectorIndexDef);
      } catch (err: unknown) {
        console.log(`Index "${chunkVectorIndexDef.name}" may already exist:`, (err as Error).message);
      }

      try {
        console.log(`Creating text search index: "${chunkTextIndexDef.name}"...`);
        await rawChunks.createSearchIndex(chunkTextIndexDef);
      } catch (err: unknown) {
        console.log(`Index "${chunkTextIndexDef.name}" may already exist:`, (err as Error).message);
      }

      try {
        console.log(`Creating cache vector index: "${cacheVectorIndexDef.name}"...`);
        await rawCache.createSearchIndex(cacheVectorIndexDef);
      } catch (err: unknown) {
        console.log(`Index "${cacheVectorIndexDef.name}" may already exist:`, (err as Error).message);
      }

      // Poll until vector indexes are READY
      console.log("\nPolling index build status...");
      let isReady = false;
      let attempts = 0;
      const maxAttempts = 15;

      while (!isReady && attempts < maxAttempts) {
        attempts++;
        const indexes = await rawChunks.listSearchIndexes().toArray();
        const vectorIndex = indexes.find(
          (idx: { name: string; status?: string }) => idx.name === chunkVectorIndexDef.name
        );

        console.log(
          `[Attempt ${attempts}/${maxAttempts}] Current Status for "${chunkVectorIndexDef.name}": ${
            vectorIndex?.status || "BUILDING"
          }`
        );

        if (vectorIndex?.status === "READY") {
          isReady = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      if (isReady) {
        console.log("Vector Search index is queryable and READY!");
      } else {
        console.log("Index is provisioning in background on Atlas. (Application fallback will handle queries in the meantime).");
      }
    } else {
      console.log("Driver does not have createSearchIndex method (Atlas Search is configured in Atlas UI or API).");
    }
  } catch (err: unknown) {
    console.warn("Notice: Search index creation requires an Atlas M0+ cluster. Error:", (err as Error).message);
    console.log("The application includes graceful fallbacks so local development and unit tests continue without disruption.");
  } finally {
    await client.close();
    console.log("Index setup script finished.");
  }
}

setupIndexes().catch((err) => {
  console.error("Setup script failed:", err);
  process.exit(1);
});
