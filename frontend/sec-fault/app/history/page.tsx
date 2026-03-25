"use client";

import Sidebar from "@/components/Sidebar";
import { ChevronRight, MessageSquare, FileText, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ConversationItem = {
  id: string;
  title: string | null;
  created_at: string;
};

export default function HistoryPage() {
  const [sideBarOpen, setSideBarOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/chats`, {
          credentials: "include",
        });
        if (res.ok) {
          setConversations(await res.json());
        }
      } catch {
        // ignore
      }
    }
    load();
  }, []);

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
            Conversation History
          </h1>
          <p className="text-text-secondary mb-8">
            View your past SEC filing analyses
          </p>

          {/* Conversation List */}
          <div className="max-w-4xl space-y-4">
            {conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => router.push(`/analyze?chat=${convo.id}`)}
                className="group w-full text-left rounded-lg border border-border bg-surface p-6 shadow-sm transition-all hover:shadow-md hover:border-accent cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <MessageSquare className="h-5 w-5 text-text-secondary shrink-0" />
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-text-primary truncate">
                        {convo.title || "Untitled Conversation"}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        {new Date(convo.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-text-secondary group-hover:text-accent transition-colors shrink-0" />
                </div>
              </button>
            ))}
          </div>

          {/* Empty State */}
          {conversations.length === 0 && (
            <div className="max-w-4xl rounded-lg border border-dashed border-border bg-sidebar bg-opacity-50 p-12 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-text-secondary" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No conversations yet
              </h3>
              <p className="text-text-secondary">
                Start analyzing SEC filings to see your history here
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
