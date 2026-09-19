import { NextRequest, NextResponse } from "next/server";
import { getSessionId, recordMessage, getConversationContext, maybeUpdateSummary } from "@/lib/memory/session";
import { getAIProvider } from "@/lib/ai/provider";
import { runHybridSearch, buildCitations } from "@/lib/retrieval/search";
import { buildRagPrompt, GUARDRAIL_FALLBACK_ANSWER } from "@/lib/retrieval/prompt";
import { checkSemanticCache, saveToSemanticCache, buildDocScopeKey } from "@/lib/cache/semantic-cache";
import { chatRequestSchema } from "@/lib/validations";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const sessionId = await getSessionId();
    const clientIp = getClientIp(req);

    // Rate limiting: 25 chat messages per minute per session
    const limit = checkRateLimit(`chat:${clientIp}:${sessionId}`, {
      windowMs: 60 * 1000,
      maxRequests: 25,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Chat rate limit exceeded. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsedInput = chatRequestSchema.safeParse(body);

    if (!parsedInput.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsedInput.error.format() },
        { status: 400 }
      );
    }

    const { message, documentIds } = parsedInput.data;
    const ai = getAIProvider();

    // 1. Record the incoming user message
    await recordMessage(sessionId, "user", message);

    // 2. Embed user question for semantic cache & vector search
    const questionEmbedding = await ai.embedQuery(message);
    const docScopeKey = buildDocScopeKey(documentIds);
    const cacheThreshold = parseFloat(process.env.SEMANTIC_CACHE_THRESHOLD || "0.92");

    // 3. Check Semantic Cache
    const cacheCheck = await checkSemanticCache(
      sessionId,
      questionEmbedding,
      docScopeKey,
      cacheThreshold
    );

    if (cacheCheck.hit && cacheCheck.answer) {
      const latencyMs = Date.now() - startTime;
      await recordMessage(
        sessionId,
        "assistant",
        cacheCheck.answer,
        cacheCheck.citations,
        latencyMs,
        true
      );

      // Return streaming response format with single pre-cached output
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "metadata",
                cacheHit: true,
                citations: cacheCheck.citations || [],
                similarity: cacheCheck.similarity,
                latencyMs,
              }) + "\n"
            )
          );
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "chunk",
                text: cacheCheck.answer,
              }) + "\n"
            )
          );
          controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    // 4. Hybrid Retrieval with Reciprocal Rank Fusion
    const topK = parseInt(process.env.RETRIEVAL_TOP_K || "5", 10);
    const scoredChunks = await runHybridSearch(message, {
      sessionId,
      documentIds,
      topK,
      mode: "hybrid",
    });

    const citations = buildCitations(scoredChunks);
    const scoreThreshold = parseFloat(process.env.RETRIEVAL_SCORE_THRESHOLD || "0.45");

    // 5. Retrieve conversation memory (rolling summary + recent messages)
    const memory = await getConversationContext(sessionId, 6);

    // 6. Build Shielded RAG Prompt with Guardrails
    const { systemInstruction, userMessageWithContext, isGrounded } = buildRagPrompt(
      message,
      scoredChunks,
      scoreThreshold,
      memory.summary
    );

    // If retrieval guardrail triggers, reply with honest fallback answer
    if (!isGrounded) {
      const latencyMs = Date.now() - startTime;
      await recordMessage(
        sessionId,
        "assistant",
        GUARDRAIL_FALLBACK_ANSWER,
        [],
        latencyMs,
        false,
        true // marked as unanswered
      );

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "metadata",
                cacheHit: false,
                citations: [],
                latencyMs,
                unanswered: true,
              }) + "\n"
            )
          );
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "chunk",
                text: GUARDRAIL_FALLBACK_ANSWER,
              }) + "\n"
            )
          );
          controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    // 7. Stream LLM Response
    const chatMessages = [
      ...memory.messages.slice(-4),
      { role: "user" as const, content: userMessageWithContext },
    ];

    const llmStream = await ai.chatStream(chatMessages, systemInstruction);
    const latencyMs = Date.now() - startTime;
    const encoder = new TextEncoder();

    let fullGeneratedAnswer = "";

    const responseStream = new ReadableStream({
      async start(controller) {
        // First emit metadata event
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "metadata",
              cacheHit: false,
              citations,
              latencyMs,
            }) + "\n"
          )
        );

        const reader = llmStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullGeneratedAnswer += value;
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: "chunk",
                  text: value,
                }) + "\n"
              )
            );
          }

          controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
          controller.close();

          // Asynchronously record message, update memory, and cache response
          const totalDuration = Date.now() - startTime;
          await Promise.allSettled([
            recordMessage(sessionId, "assistant", fullGeneratedAnswer, citations, totalDuration, false),
            saveToSemanticCache(
              sessionId,
              message,
              questionEmbedding,
              fullGeneratedAnswer,
              citations,
              docScopeKey
            ),
            maybeUpdateSummary(sessionId),
          ]);
        } catch (streamError) {
          console.error("Stream reading error:", streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error during chat processing." },
      { status: 500 }
    );
  }
}
