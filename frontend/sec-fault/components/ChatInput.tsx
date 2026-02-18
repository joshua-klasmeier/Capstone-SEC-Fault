"use client";

import { useState } from "react";

export default function ChatInput() {
  const [value, setValue] = useState("");

  return (
    <div className="border-t border-border px-6 pb-4 pt-3">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Reply to SEC Fault..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
          />
          <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity hover:opacity-80">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-text-secondary">
          SEC Fault may produce inaccurate summaries. Verify with original SEC
          filings.
        </p>
      </div>
    </div>
  );
}
