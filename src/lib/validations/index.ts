import { z } from "zod";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
] as const;

export const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".markdown"] as const;

export const chatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message exceeds 2000 characters limit"),
  documentIds: z.array(z.string()).optional().default([]),
});

export const documentFilterSchema = z.object({
  sessionId: z.string().min(1),
  status: z.enum(["processing", "ready", "failed"]).optional(),
});

export const evalCaseSchema = z.object({
  question: z.string().min(3),
  expectedSource: z.string().min(1),
  expectedKeywords: z.array(z.string()).optional(),
});

export const evalRunRequestSchema = z.object({
  topK: z.number().int().min(1).max(20).default(5),
});

export function isValidFileType(filename: string, mimeType?: string): boolean {
  const lowerName = filename.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!hasValidExt) return false;

  if (mimeType && mimeType !== "application/octet-stream") {
    return ALLOWED_MIME_TYPES.some(
      (type) => mimeType.startsWith(type) || mimeType.includes("pdf") || mimeType.includes("text")
    );
  }

  return true;
}

export function sanitizeFilename(raw: string): string {
  // Strip path traversal characters, normalize spaces
  return raw
    .replace(/^.*[\\\/]/, "")
    .replace(/[^a-zA-Z0-9._\- ]/g, "_")
    .trim()
    .slice(0, 150);
}
