"use client";

import Sidebar from "@/components/Sidebar";
import { Sparkles, FileText, MessageSquarePlus, Bookmark, Menu} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [sideBarOpen, setSideBarOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      router.push("/analyze");
      return;
    }

    const params = new URLSearchParams({ prompt: trimmedPrompt });
    router.push(`/analyze?${params.toString()}`);
  };

  const handleRecPillClick = (example: string) => {
    sessionStorage.setItem('initialPrompt', example);
    router.push("/analyze");
  };

  const examplePrompts = [
    "Summarize Apple's latest 10-K filing",
    "What are Tesla's revenue trends from their Q3 report?",
    "Analyze Microsoft's recent 8-K filing",
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Toggle Button */}
      {!sideBarOpen && (
        <button
        onClick={() => setSideBarOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-accent text-white hover:opacity-90"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}
      
      {sideBarOpen && <Sidebar toggleSidebar={() => setSideBarOpen(false)} />}

      <main className="flex flex-1 flex-col overflow-y-auto">
        {/* Hero Section with Prompt Input */}
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-12">
          <div className="w-full max-w-3xl">
            <div className="text-center mb-8">
              <h1 className="text-5xl font-bold text-text-primary mb-4">
                SEC Filing Analyzer
              </h1>
              <p className="text-xl text-text-secondary">
                Ask me anything about SEC filings and get instant, plain-English summaries
              </p>
            </div>

            {/* Prompt Input */}
            <form onSubmit={handleSubmit} className="mb-6">
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What would you like to know? (e.g., 'Summarize Tesla's latest earnings report')"
                  className="flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-secondary resize-none min-h-[100px]"
                  rows={4}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-opacity-90"
                  >
                    <Sparkles className="h-4 w-4" />
                    Analyze
                  </button>
                </div>
              </div>
            </form>

            {/* Example Prompts */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-text-secondary">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {examplePrompts.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRecPillClick(example)}
                    className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-primary transition-colors hover:border-accent hover:bg-accent hover:bg-opacity-5"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="border-t border-border bg-sidebar bg-opacity-30 px-8 py-12">
          <div className="mx-auto grid max-w-5xl grid-cols-3 gap-6">
            {/* Recent Summaries Card */}
            <Link href="/history" className="group rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:shadow-md hover:border-accent">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent mb-4">
                <FileText className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Recent Summaries
              </h3>
              <p className="text-sm text-text-secondary">
                View your previously generated SEC filing summaries
              </p>
            </Link>

            {/* New Analysis Card */}
            <Link href="/analyze" className="group rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:shadow-md hover:border-accent">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent mb-4">
                <MessageSquarePlus className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                New Analysis
              </h3>
              <p className="text-sm text-text-secondary">
                Start a conversation to analyze SEC filings
              </p>
            </Link>

            {/* Search by Ticker Card */}
            <Link href="/filings" className="group rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:shadow-md hover:border-accent">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent mb-4">
                <Bookmark className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Search by Ticker
              </h3>
              <p className="text-sm text-text-secondary">
                Look up specific companies by ticker or CIK
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
