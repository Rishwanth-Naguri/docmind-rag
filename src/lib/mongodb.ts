import { MongoClient, Db, Collection } from "mongodb";
import {
  DocumentRecord,
  ChunkRecord,
  SessionRecord,
  MessageRecord,
  SemanticCacheRecord,
  EvalCaseRecord,
  EvalRunRecord,
} from "./types/database";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/docmind";
const dbName = process.env.MONGODB_DB_NAME || "docmind";

interface GlobalWithMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}

declare const global: GlobalWithMongo;

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!process.env.MONGODB_URI) {
  // In build or development without URI, log a helpful warning
  console.warn("MONGODB_URI is not defined in environment variables. Using fallback localhost.");
}

const options = {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
};

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the MongoClient value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode (e.g. Vercel Serverless Functions), it's best to not use a
  // global variable for HMR, but caching the promise at the module scope ensures
  // connections are reused across serverless invocations on the same container.
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
}

export default clientPromise;

export async function getDb(): Promise<Db> {
  const clientInstance = await clientPromise;
  return clientInstance.db(dbName);
}

export async function getDocumentsCollection(): Promise<Collection<DocumentRecord>> {
  const db = await getDb();
  return db.collection<DocumentRecord>("documents");
}

export async function getChunksCollection(): Promise<Collection<ChunkRecord>> {
  const db = await getDb();
  return db.collection<ChunkRecord>("chunks");
}

export async function getSessionsCollection(): Promise<Collection<SessionRecord>> {
  const db = await getDb();
  return db.collection<SessionRecord>("sessions");
}

export async function getMessagesCollection(): Promise<Collection<MessageRecord>> {
  const db = await getDb();
  return db.collection<MessageRecord>("messages");
}

export async function getSemanticCacheCollection(): Promise<Collection<SemanticCacheRecord>> {
  const db = await getDb();
  return db.collection<SemanticCacheRecord>("semantic_cache");
}

export async function getEvalCasesCollection(): Promise<Collection<EvalCaseRecord>> {
  const db = await getDb();
  return db.collection<EvalCaseRecord>("eval_cases");
}

export async function getEvalRunsCollection(): Promise<Collection<EvalRunRecord>> {
  const db = await getDb();
  return db.collection<EvalRunRecord>("eval_runs");
}
