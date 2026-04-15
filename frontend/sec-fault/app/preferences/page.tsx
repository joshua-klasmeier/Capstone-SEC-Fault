"use client";

import Sidebar from "@/components/Sidebar";
import { apiUrl } from "@/lib/api";
import { Menu, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

type Complexity = "beginner" | "expert";

export default function PreferencesPage() {
  const [sideBarOpen, setSideBarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Complexity>("beginner");

  useEffect(() => {
    async function loadPreference() {
      try {
        const res = await fetch(apiUrl("/preferences/me"), {
          credentials: "include",
          cache: "no-store",
        });

        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to load preferences");
        }

        const data = await res.json();
        setSelected(data.response_complexity === "expert" ? "expert" : "beginner");
      } catch {
        setError("Unable to load preferences right now.");
      } finally {
        setLoading(false);
      }
    }

    loadPreference();
  }, []);

  async function updatePreference(nextValue: Complexity) {
    const previousValue = selected;
    setSelected(nextValue);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/preferences/me"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response_complexity: nextValue }),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to save preference");
      }

      const data = await res.json();
      setSelected(data.response_complexity === "expert" ? "expert" : "beginner");
    } catch {
      setSelected(previousValue);
      setError("Unable to save preference. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {!sideBarOpen && (
        <button
          onClick={() => setSideBarOpen(true)}
          className="fixed top-4 left-4 z-50 rounded-lg bg-accent p-2 text-white hover:opacity-90"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {sideBarOpen && <Sidebar toggleSidebar={() => setSideBarOpen(false)} />}

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-12">
          <div className="mb-8 flex items-center gap-3">
            <SlidersHorizontal className="h-7 w-7 text-accent" />
            <div>
              <h1 className="text-3xl font-bold text-text-primary">Preferences</h1>
              <p className="mt-1 text-text-secondary">
                Choose how technical SEC Fault responses should be.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              disabled={loading || saving}
              onClick={() => updatePreference("beginner")}
              className={`w-full rounded-xl border p-5 text-left transition-colors ${
                selected === "beginner"
                  ? "border-accent bg-surface"
                  : "border-border bg-surface hover:border-accent"
              }`}
            >
              <div className="text-lg font-semibold text-text-primary">Beginner</div>
              <p className="mt-1 text-sm text-text-secondary">
                Simpler explanations, clearer wording, and less jargon.
              </p>
            </button>

            <button
              type="button"
              disabled={loading || saving}
              onClick={() => updatePreference("expert")}
              className={`w-full rounded-xl border p-5 text-left transition-colors ${
                selected === "expert"
                  ? "border-accent bg-surface"
                  : "border-border bg-surface hover:border-accent"
              }`}
            >
              <div className="text-lg font-semibold text-text-primary">Expert</div>
              <p className="mt-1 text-sm text-text-secondary">
                More technical detail and denser financial terminology.
              </p>
            </button>
          </div>

          <div className="mt-4 text-sm text-text-secondary">
            {loading && "Loading your preference..."}
            {!loading && saving && "Saving..."}
            {!loading && !saving && `Current setting: ${selected}`}
          </div>

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>
      </main>
    </div>
  );
}
