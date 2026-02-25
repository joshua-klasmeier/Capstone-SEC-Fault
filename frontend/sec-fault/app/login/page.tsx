"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

// Backend API base URL.
// In development, this defaults to localhost:8000, but can be
// overridden via NEXT_PUBLIC_API_URL for deployed environments.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleGoogleLogin() {
    setLoading(true);
    setError(null);

    try {
      window.location.href = `${API_URL}/auth/login`;
    } catch (err) {
      setError("Unable to start Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="m-auto w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              SEC Fault
            </div>
            <div className="text-lg font-semibold text-text-primary">
              Sign in
            </div>
          </div>
        </div>

        <p className="mb-6 text-sm text-text-secondary">
          Continue with your Google account to access SEC filing
          analysis and your saved history.
        </p>

        {error && (
          <p className="mb-3 text-sm text-red-500">{error}</p>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-opacity-90 disabled:opacity-60"
        >
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>

        <p className="text-xs text-text-secondary">
          By continuing, you agree to use this prototype application
          for educational purposes only. Data may be logged for
          debugging during the course project.
        </p>

        <div className="mt-4 text-right text-xs text-text-secondary">
          <Link href="/" className="hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
