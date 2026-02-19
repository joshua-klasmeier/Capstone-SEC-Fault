import Sidebar from "@/components/Sidebar";
import { Search, FileText, TrendingUp, Bookmark } from "lucide-react";

export default function Home() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        {/* Hero Section */}
        <div className="px-8 pt-12 pb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-3">
            SEC Filing Analyzer
          </h1>
          <p className="text-lg text-text-secondary mb-6">
            Get instant, plain-English summaries of company financial filings
          </p>
          
          {/* Search Bar */}
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm">
              <Search className="h-5 w-5 text-text-secondary" />
              <input
                type="text"
                placeholder="Enter company ticker or CIK number..."
                className="flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-secondary"
              />
              <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-opacity-90">
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="px-8 pb-12">
          <div className="grid grid-cols-2 gap-6 max-w-5xl">
            {/* Quick Search Card */}
            <div className="group rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:shadow-md hover:border-accent">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent mb-4">
                <Search className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Quick Search
              </h3>
              <p className="text-sm text-text-secondary">
                Search for any company by ticker symbol or CIK number to view their latest filings
              </p>
            </div>

            {/* Recent Summaries Card */}
            <div className="group rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:shadow-md hover:border-accent">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent mb-4">
                <FileText className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Recent Summaries
              </h3>
              <p className="text-sm text-text-secondary">
                Access your recently generated SEC filing summaries and reports
              </p>
            </div>

            {/* Popular Companies Card */}
            <div className="group rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:shadow-md hover:border-accent">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent mb-4">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Popular Companies
              </h3>
              <p className="text-sm text-text-secondary">
                Browse frequently analyzed companies like Apple, Tesla, Microsoft, and more
              </p>
            </div>

            {/* Saved Reports Card */}
            <div className="group rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:shadow-md hover:border-accent">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-accent mb-4">
                <Bookmark className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Saved Reports
              </h3>
              <p className="text-sm text-text-secondary">
                View and manage your bookmarked SEC filing summaries for quick access
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
