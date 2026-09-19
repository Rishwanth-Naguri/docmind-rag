import { NextRequest, NextResponse } from "next/server";
import { runEvaluationBenchmark } from "@/lib/eval/benchmark";
import { getSessionId } from "@/lib/memory/session";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const sessionId = await getSessionId();
    const body = await req.json().catch(() => ({}));
    const topK = typeof body.topK === "number" ? body.topK : 5;

    const evalResult = await runEvaluationBenchmark(sessionId, topK);

    return NextResponse.json({
      success: true,
      evaluation: evalResult,
    });
  } catch (error: unknown) {
    console.error("Eval run error:", error);
    const message = error instanceof Error ? error.message : "Evaluation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
