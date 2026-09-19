import { cookies } from "next/headers";
import crypto from "crypto";
import { getSessionsCollection, getMessagesCollection } from "../mongodb";
import { MessageRecord, SessionRecord, MessageRole, Citation } from "../types/database";
import { getAIProvider } from "../ai/provider";

export const SESSION_COOKIE_NAME = "docmind_session";

/**
 * Retrieves the current session ID from cookies or creates a new one.
 */
export async function getSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (existingCookie && existingCookie.trim().length > 0) {
    return existingCookie;
  }

  const newSessionId = crypto.randomUUID();
  cookieStore.set(SESSION_COOKIE_NAME, newSessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  // Persist session to MongoDB
  try {
    const sessionsCol = await getSessionsCollection();
    await sessionsCol.updateOne(
      { _id: newSessionId },
      {
        $setOnInsert: {
          _id: newSessionId,
          createdAt: new Date(),
          lastActiveAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn("Could not save session to MongoDB:", err);
  }

  return newSessionId;
}

/**
 * Updates the last active timestamp for an existing session
 */
export async function touchSession(sessionId: string): Promise<void> {
  try {
    const sessionsCol = await getSessionsCollection();
    await sessionsCol.updateOne(
      { _id: sessionId },
      { $set: { lastActiveAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.warn("Failed to touch session:", err);
  }
}

/**
 * Persists a chat message into the database
 */
export async function recordMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
  citations?: Citation[],
  latencyMs?: number,
  cacheHit?: boolean,
  unanswered?: boolean
): Promise<void> {
  try {
    const messagesCol = await getMessagesCollection();
    await messagesCol.insertOne({
      sessionId,
      role,
      content,
      citations: citations || [],
      latencyMs,
      cacheHit: Boolean(cacheHit),
      unanswered: Boolean(unanswered),
      createdAt: new Date(),
    });
    await touchSession(sessionId);
  } catch (err) {
    console.error("Failed to record message:", err);
  }
}

/**
 * Retrieves the last N messages for a session and checks for rolling summary
 */
export async function getConversationContext(
  sessionId: string,
  limitCount: number = 6
): Promise<{
  messages: { role: MessageRole; content: string }[];
  summary?: string;
}> {
  try {
    const [sessionsCol, messagesCol] = await Promise.all([
      getSessionsCollection(),
      getMessagesCollection(),
    ]);

    const session = await sessionsCol.findOne({ _id: sessionId });

    const rawMessages = await messagesCol
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(limitCount)
      .toArray();

    const chronological = rawMessages.reverse().map((m) => ({
      role: m.role,
      content: m.content,
    }));

    return {
      messages: chronological,
      summary: session?.summary,
    };
  } catch (err) {
    console.warn("Error retrieving conversation context:", err);
    return { messages: [] };
  }
}

/**
 * Incrementally updates the conversation summary when history grows
 */
export async function maybeUpdateSummary(sessionId: string): Promise<void> {
  try {
    const messagesCol = await getMessagesCollection();
    const count = await messagesCol.countDocuments({ sessionId });

    // Update summary every 6 messages
    if (count > 0 && count % 6 === 0) {
      const recent = await messagesCol
        .find({ sessionId })
        .sort({ createdAt: -1 })
        .limit(8)
        .toArray();

      const chatHistoryText = recent
        .reverse()
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

      const ai = getAIProvider();
      const prompt = `Summarize the following discussion concisely in 2-3 sentences for memory context:\n\n${chatHistoryText}`;
      const newSummary = await ai.generateText(prompt);

      const sessionsCol = await getSessionsCollection();
      await sessionsCol.updateOne({ _id: sessionId }, { $set: { summary: newSummary } });
    }
  } catch (err) {
    console.warn("Could not generate conversation summary:", err);
  }
}
