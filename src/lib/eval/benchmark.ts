import { getEvalCasesCollection, getEvalRunsCollection } from "../mongodb";
import { EvalCaseRecord, EvalModeResult, EvalRunRecord } from "../types/database";
import { runHybridSearch } from "../retrieval/search";

export async function getEvalCases(): Promise<EvalCaseRecord[]> {
  const col = await getEvalCasesCollection();
  return col.find({}).toArray();
}

/**
 * Runs retrieval evaluation comparing Vector-only, Keyword-only, and Hybrid RRF across golden test cases
 */
export async function runEvaluationBenchmark(sessionId: string, topK: number = 5): Promise<EvalRunRecord> {
  const cases = await getEvalCases();
  if (cases.length === 0) {
    throw new Error("No evaluation cases found in database. Run 'npm run seed' to populate test cases.");
  }

  async function evaluateMode(mode: "vector" | "keyword" | "hybrid"): Promise<EvalModeResult> {
    let hits1 = 0;
    let hits3 = 0;
    let hits5 = 0;
    let totalLatency = 0;

    const details: EvalModeResult["details"] = [];

    for (const testCase of cases) {
      const startTime = Date.now();
      const results = await runHybridSearch(testCase.question, {
        sessionId,
        topK,
        mode: mode === "hybrid" ? "hybrid" : mode,
      });
      const latency = Date.now() - startTime;
      totalLatency += latency;

      const retrievedSources = results.map((r) => r.source);
      const expected = testCase.expectedSource.toLowerCase();

      const hitAt1 = retrievedSources.slice(0, 1).some((s) => s.toLowerCase().includes(expected));
      const hitAt3 = retrievedSources.slice(0, 3).some((s) => s.toLowerCase().includes(expected));
      const hitAt5 = retrievedSources.slice(0, 5).some((s) => s.toLowerCase().includes(expected));

      if (hitAt1) hits1++;
      if (hitAt3) hits3++;
      if (hitAt5) hits5++;

      details.push({
        question: testCase.question,
        expectedSource: testCase.expectedSource,
        retrievedSources,
        hitAt1,
        hitAt3,
        hitAt5,
        score: results[0]?.score || 0,
      });
    }

    const total = cases.length;
    return {
      hitRateAt1: Number((hits1 / total).toFixed(3)),
      hitRateAt3: Number((hits3 / total).toFixed(3)),
      hitRateAt5: Number((hits5 / total).toFixed(3)),
      avgLatencyMs: Math.round(totalLatency / total),
      details,
    };
  }

  const [vectorOnly, keywordOnly, hybridRrf] = await Promise.all([
    evaluateMode("vector"),
    evaluateMode("keyword"),
    evaluateMode("hybrid"),
  ]);

  const summary = `Benchmark evaluated on ${cases.length} cases. Hybrid RRF achieved ${(
    hybridRrf.hitRateAt5 * 100
  ).toFixed(1)}% Hit@5 vs ${(vectorOnly.hitRateAt5 * 100).toFixed(1)}% (Vector) and ${(
    keywordOnly.hitRateAt5 * 100
  ).toFixed(1)}% (Keyword).`;

  const runRecord: EvalRunRecord = {
    createdAt: new Date(),
    results: {
      vectorOnly,
      keywordOnly,
      hybridRrf,
    },
    summary,
  };

  const runsCol = await getEvalRunsCollection();
  const insertResult = await runsCol.insertOne(runRecord);
  runRecord._id = insertResult.insertedId;

  return runRecord;
}
