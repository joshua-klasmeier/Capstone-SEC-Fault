"use client";
import Sidebar from "@/components/Sidebar";
import { filingHistory } from "@/lib/mockData";
import { ChevronRight, FileText, Menu } from "lucide-react";
import { useState } from "react";

export default function HistoryPage() {
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
      
      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-12">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            SEC Filings History
          </h1>
          <p className="text-text-secondary mb-8">
            View all your previously analyzed SEC filings
          </p>

          {/* History List */}
          <div className="max-w-4xl space-y-4">
            {filingHistory.map((filing) => (
              <div
                key={filing.id}
                className="group rounded-lg border border-border bg-surface p-6 shadow-sm transition-all hover:shadow-md hover:border-accent cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-text-primary">
                        {filing.company}
                      </h3>
                      <span className="inline-flex items-center rounded-full border border-accent px-2.5 py-0.5 text-xs font-medium text-accent">
                        {filing.ticker}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-sidebar px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                        {filing.filingType}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {new Date(filing.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-text-secondary group-hover:text-accent transition-colors" />
                </div>
                <p className="text-text-primary leading-relaxed">
                  {filing.summary}
                </p>
              </div>
            ))}
          </div>

          {/* Empty State (if no history) */}
          {filingHistory.length === 0 && (
            <div className="max-w-4xl rounded-lg border border-dashed border-border bg-sidebar bg-opacity-50 p-12 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-text-secondary" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No filing history yet
              </h3>
              <p className="text-text-secondary">
                Start analyzing SEC filings to see them here
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
