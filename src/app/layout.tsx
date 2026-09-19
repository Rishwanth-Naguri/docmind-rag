import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DocMind | MongoDB Atlas Vector Search RAG Chatbot",
  description:
    "Enterprise RAG chatbot over user-uploaded documents powered by MongoDB Atlas Vector Search, Atlas Search, Reciprocal Rank Fusion, semantic caching, and aggregation pipelines.",
  keywords: [
    "MongoDB Atlas",
    "Vector Search",
    "RAG",
    "Reciprocal Rank Fusion",
    "Semantic Cache",
    "Gemini",
    "Next.js",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
