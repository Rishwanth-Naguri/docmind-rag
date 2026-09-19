import { getMessagesCollection, getDocumentsCollection } from "../mongodb";

export interface AnalyticsSummary {
  totalQueries: number;
  cacheHits: number;
  cacheHitRate: number;
  avgLatencyMs: number;
  totalDocuments: number;
  queriesPerDay: { date: string; count: number }[];
  latencyBuckets: { range: string; count: number }[];
  mostCitedDocuments: { source: string; citationCount: number; mimeType?: string }[];
  unansweredQuestions: { question: string; date: string }[];
}

/**
 * Computes deep analytics using MongoDB Aggregation pipelines:
 * $group, $facet, $bucket, $lookup, $dateTrunc
 */
export async function getAnalyticsMetrics(sessionId?: string): Promise<AnalyticsSummary> {
  const [messagesCol, docsCol] = await Promise.all([
    getMessagesCollection(),
    getDocumentsCollection(),
  ]);

  const matchFilter: Record<string, unknown> = { role: "assistant" };
  if (sessionId) {
    matchFilter.sessionId = sessionId;
  }

  // Multi-faceted aggregation pipeline
  const pipeline = [
    { $match: matchFilter },
    {
      $facet: {
        // 1. Overall stats
        overall: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              cacheHits: {
                $sum: { $cond: [{ $eq: ["$cacheHit", true] }, 1, 0] },
              },
              avgLatency: { $avg: "$latencyMs" },
            },
          },
        ],
        // 2. Latency Buckets via $bucket
        latencyBuckets: [
          {
            $match: { latencyMs: { $exists: true, $ne: null } },
          },
          {
            $bucket: {
              groupBy: "$latencyMs",
              boundaries: [0, 250, 500, 1000, 2000, 5000, 10000],
              default: "10000+",
              output: {
                count: { $sum: 1 },
              },
            },
          },
        ],
        // 3. Queries grouped by day via $dateTrunc
        dailyVolume: [
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 as const } },
        ],
        // 4. Most-cited documents ($unwind, $group, $lookup)
        mostCited: [
          { $unwind: "$citations" },
          {
            $group: {
              _id: "$citations.source",
              citationCount: { $sum: 1 },
            },
          },
          { $sort: { citationCount: -1 as const } },
          { $limit: 8 },
          {
            $lookup: {
              from: "documents",
              localField: "_id",
              foreignField: "filename",
              as: "docInfo",
            },
          },
          {
            $project: {
              source: "$_id",
              citationCount: 1,
              mimeType: { $arrayElemAt: ["$docInfo.mimeType", 0] },
            },
          },
        ],
      },
    },
  ];

  let rawFacetResults: {
    overall: { total: number; cacheHits: number; avgLatency: number }[];
    latencyBuckets: { _id: number | string; count: number }[];
    dailyVolume: { _id: string; count: number }[];
    mostCited: { source: string; citationCount: number; mimeType?: string }[];
  }[] = [];

  try {
    rawFacetResults = (await messagesCol.aggregate(pipeline as any).toArray()) as any;
  } catch (err) {
    console.warn("MongoDB aggregation facet failed (e.g. running in mock/dev):", err);
  }

  // Count total documents in collection
  let totalDocs = 0;
  try {
    totalDocs = await docsCol.countDocuments(sessionId ? { sessionId } : {});
  } catch {
    totalDocs = 0;
  }

  // Retrieve top unanswered queries
  let unansweredQuestions: { question: string; date: string }[] = [];
  try {
    const unansweredDocs = await messagesCol
      .find({
        ...matchFilter,
        $or: [
          { unanswered: true },
          { content: { $regex: "couldn't find that in your documents", $options: "i" } },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    unansweredQuestions = unansweredDocs.map((doc) => ({
      question: doc.content.slice(0, 100),
      date: doc.createdAt.toISOString().slice(0, 10),
    }));
  } catch {
    unansweredQuestions = [];
  }

  const facet = rawFacetResults[0] || {
    overall: [],
    latencyBuckets: [],
    dailyVolume: [],
    mostCited: [],
  };

  const overall = facet.overall[0] || { total: 0, cacheHits: 0, avgLatency: 0 };
  const totalQueries = overall.total || 0;
  const cacheHits = overall.cacheHits || 0;
  const cacheHitRate = totalQueries > 0 ? Number((cacheHits / totalQueries).toFixed(3)) : 0;
  const avgLatencyMs = Math.round(overall.avgLatency || 0);

  const bucketLabels: Record<string, string> = {
    "0": "0-250ms",
    "250": "250-500ms",
    "500": "500ms-1s",
    "1000": "1s-2s",
    "2000": "2s-5s",
    "5000": "5s-10s",
    "10000+": ">10s",
  };

  const latencyBuckets = (facet.latencyBuckets || []).map((b) => ({
    range: bucketLabels[String(b._id)] || String(b._id),
    count: b.count,
  }));

  const queriesPerDay = (facet.dailyVolume || []).map((d) => ({
    date: d._id,
    count: d.count,
  }));

  return {
    totalQueries,
    cacheHits,
    cacheHitRate,
    avgLatencyMs,
    totalDocuments: totalDocs,
    queriesPerDay,
    latencyBuckets,
    mostCitedDocuments: facet.mostCited || [],
    unansweredQuestions,
  };
}
