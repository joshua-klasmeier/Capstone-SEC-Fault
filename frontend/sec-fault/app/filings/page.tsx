"use client";
import Sidebar from "@/components/Sidebar";
import { Info, Menu } from "lucide-react";
import { useState } from "react";


export default function FilingsPage() {
  const [sideBarOpen, setSideBarOpen] = useState(false);

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

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-12">
          <h1 className="text-3xl font-bold text-text-primary mb-3">
            SEC Filings Search
          </h1>
          <p className="text-lg text-text-secondary mb-8">
            Search and analyze SEC filings from the EDGAR database
          </p>

          {/* Search Section */}
          <div className="max-w-3xl">
            <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
              <label className="block text-sm font-medium text-text-primary mb-2">
                Company Ticker or CIK
              </label>
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="text"
                  placeholder="e.g., AAPL or 0000320193"
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-text-primary outline-none focus:border-accent placeholder:text-text-secondary"
                />
                <button className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-opacity-90">
                  Search
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-3 mt-4">
                <button className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-text-primary transition-colors hover:border-accent hover:bg-surface">
                  10-K (Annual)
                </button>
                <button className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-text-primary transition-colors hover:border-accent hover:bg-surface">
                  10-Q (Quarterly)
                </button>
                <button className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-text-primary transition-colors hover:border-accent hover:bg-surface">
                  8-K (Current)
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 rounded-lg bg-opacity-10 border border-accent border-opacity-20 p-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                <div className="text-sm text-text-primary">
                  <p className="font-medium mb-1">How to use:</p>
                  <ul className="list-disc list-inside space-y-1 text-text-secondary">
                    <li>Enter a company ticker symbol (e.g., AAPL, TSLA, MSFT)</li>
                    <li>Or enter the CIK number from SEC EDGAR</li>
                    <li>Select a filing type or search all filings</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
