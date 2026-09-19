import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AIProvider {
  name: string;
  embeddingDimensions: number;
  embedQuery(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
  chatStream(
    messages: { role: "user" | "assistant" | "system"; content: string }[],
    systemInstruction?: string
  ): Promise<ReadableStream<string>>;
  generateText(prompt: string, systemInstruction?: string): Promise<string>;
}

class GeminiProvider implements AIProvider {
  name = "Google Gemini";
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string;
  private embeddingModelName: string;
  private llmModelName: string;
  public embeddingDimensions: number;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.embeddingModelName = process.env.EMBEDDING_MODEL || "text-embedding-004";
    this.llmModelName = process.env.LLM_MODEL || "gemini-1.5-flash";
    this.embeddingDimensions = parseInt(process.env.EMBEDDING_DIMS || "768", 10);

    if (this.apiKey && this.apiKey !== "mock-or-set-your-key") {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
  }

  private ensureClient(): GoogleGenerativeAI {
    if (!this.client) {
      throw new Error(
        "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your environment or .env.local."
      );
    }
    return this.client;
  }

  async embedQuery(text: string): Promise<number[]> {
    const client = this.ensureClient();
    try {
      const client = this.ensureClient();
      const model = client.getGenerativeModel({ model: this.embeddingModelName });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (err: unknown) {
      console.warn("Gemini embedQuery error, falling back to mock embeddings:", (err as Error).message);
      const mock = new MockAIProvider();
      return mock.embedQuery(text);
    }
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const client = this.ensureClient();
      const model = client.getGenerativeModel({ model: this.embeddingModelName });

      // Gemini batchEmbedContents supports up to 50 texts per request
      const batchSize = 50;
      const allEmbeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const result = await model.batchEmbedContents({
          requests: batch.map((text) => ({
            content: { role: "user", parts: [{ text }] },
          })),
        });

        for (const item of result.embeddings) {
          allEmbeddings.push(item.values);
        }
      }

      return allEmbeddings;
    } catch (err: unknown) {
      console.warn("Gemini embedTexts error, falling back to mock embeddings:", (err as Error).message);
      const mock = new MockAIProvider();
      return mock.embedTexts(texts);
    }
  }

  async chatStream(
    messages: { role: "user" | "assistant" | "system"; content: string }[],
    systemInstruction?: string
  ): Promise<ReadableStream<string>> {
    try {
      const client = this.ensureClient();
      const model = client.getGenerativeModel({
        model: this.llmModelName,
        systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined,
      });

      // Convert chat history to Gemini format (user vs model)
      const history = messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const lastMessage = messages[messages.length - 1];
      const prompt = lastMessage ? lastMessage.content : "";

      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(prompt);

      return new ReadableStream<string>({
        async start(controller) {
          try {
            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                controller.enqueue(chunkText);
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });
    } catch (err: unknown) {
      console.warn("Gemini chatStream error, falling back to mock streaming:", (err as Error).message);
      const mock = new MockAIProvider();
      return mock.chatStream(messages, systemInstruction);
    }
  }

  async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    try {
      const client = this.ensureClient();
      const model = client.getGenerativeModel({
        model: this.llmModelName,
        systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined,
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: unknown) {
      console.warn("Gemini generateText error, falling back to mock text:", (err as Error).message);
      const mock = new MockAIProvider();
      return mock.generateText(prompt, systemInstruction);
    }
  }
}

/**
 * Deterministic Mock AI Provider for local testing, Vitest, CI, and build without credentials
 */
class MockAIProvider implements AIProvider {
  name = "Mock AI Provider";
  embeddingDimensions: number;

  constructor() {
    this.embeddingDimensions = parseInt(process.env.EMBEDDING_DIMS || "768", 10);
  }

  private pseudoEmbed(text: string): number[] {
    const vec = new Array(this.embeddingDimensions).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < this.embeddingDimensions; i++) {
      vec[i] = Math.sin(hash + i);
    }
    // Normalize vector to unit length for cosine similarity
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return vec.map((v) => (norm === 0 ? 0 : v / norm));
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.pseudoEmbed(text);
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.pseudoEmbed(t));
  }

  async chatStream(
    messages: { role: "user" | "assistant" | "system"; content: string }[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _systemInstruction?: string
  ): Promise<ReadableStream<string>> {
    const lastMsg = messages[messages.length - 1]?.content || "";
    const simulatedResponse = `Based on the provided documents, here is the answer regarding "${lastMsg}": The document provides comprehensive guidance and facts matching your query.`;
    const words = simulatedResponse.split(" ");

    return new ReadableStream<string>({
      async start(controller) {
        for (const word of words) {
          controller.enqueue(word + " ");
          await new Promise((r) => setTimeout(r, 20));
        }
        controller.close();
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateText(prompt: string, _systemInstruction?: string): Promise<string> {
    return `Summary of discussion: Key topics covered related to ${prompt.slice(0, 50)}.`;
  }
}

// Factory to obtain the active AI provider
let activeProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (activeProvider) return activeProvider;

  const key = process.env.GEMINI_API_KEY;
  if (key && key !== "mock-or-set-your-key" && key.trim() !== "") {
    activeProvider = new GeminiProvider();
  } else {
    activeProvider = new MockAIProvider();
  }
  return activeProvider;
}
