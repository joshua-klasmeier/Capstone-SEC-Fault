"use client";

import Sidebar from "@/components/Sidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import { useState } from "react";
import { Menu } from "lucide-react";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function AnalyzePage() {
  const [sideBarOpen, setSideBarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm **SEC Fault**, your AI assistant here to help you navigate the world of SEC filings and financial reports.\n\nI can help you with:\n- **Summarizing** 10-K, 10-Q, and 8-K filings\n- **Analyzing** revenue trends and financial data\n- **Explaining** complex financial terminology\n\nWhat would you like to explore today?"
    }
  ]);

  const handleNewMessage = (userMessage: Message, assistantMessage: Message) => {
    setMessages(prev => [...prev, userMessage, assistantMessage]);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Toggle Button */}
      {!sideBarOpen && (
        <button
          onClick={() => setSideBarOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-accent text-white hover:opacity-90 shadow-md"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {sideBarOpen && <Sidebar toggleSidebar={() => setSideBarOpen(false)} />}

      <main className="flex flex-1 flex-col">
        <ChatMessages messages={messages} loading={loading} />
        <ChatInput onNewMessage={handleNewMessage} loading={loading} setLoading={setLoading} />
      </main>
    </div>
  );
}
