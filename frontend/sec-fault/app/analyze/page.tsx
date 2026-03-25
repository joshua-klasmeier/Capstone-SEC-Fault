"use client";

import Sidebar from "@/components/Sidebar";
import ChatMessages, { Message } from "@/components/ChatMessages";
import ChatInput, { ChatInputHandle } from "@/components/ChatInput";
import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content:
    "Hello! I'm SEC Fault, your AI assistant here to help you navigate the world of SEC filings and financial reports.",
  suggestions: [
    "Summarize Apple's latest 10-K",
    "What are Tesla's key risks?",
    "Explain Microsoft's revenue trends",
  ],
};

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzeContent />
    </Suspense>
  );
}

function AnalyzeContent() {
  const [sideBarOpen, setSideBarOpen] = useState(false);
  const chatInputRef = useRef<ChatInputHandle>(null);
  const searchParams = useSearchParams();

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [conversations, setConversations] = useState<
    { id: string; title: string | null; created_at: string }[]
  >([]);

  // Fetch user's conversation list
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/chats`, { credentials: "include" });
      if (res.ok) {
        setConversations(await res.json());
      }
    } catch {
      // ignore — user may not be logged in
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load chat from ?chat= query param (e.g. coming from history page)
  useEffect(() => {
    const chatParam = searchParams.get("chat");
    if (chatParam && chatParam !== chatId) {
      loadChat(chatParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Create a new conversation on the backend, return the id
  const ensureChat = async (): Promise<string> => {
    if (chatId) return chatId;

    const res = await fetch(`${API_URL}/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: "New Analysis" }),
    });

    if (res.status === 401) {
      window.location.href = "/login";
      throw new Error("Not authenticated");
    }

    const data = await res.json();
    setChatId(data.id);
    loadConversations();
    return data.id;
  };

  // Load an existing conversation
  const loadChat = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/chats/${id}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setChatId(id);
      const loaded: Message[] = data.messages.map(
        (m: { id: string; role: string; content: string }) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        })
      );
      setMessages([GREETING, ...loaded]);
    } catch {
      // ignore
    }
  };

  // Start a fresh conversation
  const startNewChat = () => {
    setChatId(null);
    setMessages([GREETING]);
  };

  const handleNewMessage = (userMessage: Message, assistantMessage: Message) => {
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    loadConversations();
  };

  const handleSuggestionClick = (text: string) => {
    chatInputRef.current?.sendMessage(text);
  };

  return (
    <div className="flex h-screen bg-background">
      {!sideBarOpen && (
        <button
          onClick={() => setSideBarOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-accent text-white hover:opacity-90"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {sideBarOpen && (
        <Sidebar
          toggleSidebar={() => setSideBarOpen(false)}
          conversations={conversations}
          activeChatId={chatId}
          onSelectChat={loadChat}
          onNewChat={startNewChat}
        />
      )}

      <main className="flex flex-1 flex-col">
        <ChatMessages messages={messages} onSuggestionClick={handleSuggestionClick} />
        <ChatInput
          ref={chatInputRef}
          chatId={chatId}
          ensureChat={ensureChat}
          onNewMessage={handleNewMessage}
        />
      </main>
    </div>
  );
}
