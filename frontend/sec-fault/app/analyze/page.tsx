"use client";

import Sidebar from "@/components/Sidebar";
import ChatMessages, { Message } from "@/components/ChatMessages";
import ChatInput, { ChatInputHandle } from "@/components/ChatInput";
import { useState, useRef } from "react";
import { Menu } from "lucide-react";

const CHAT_ID = 1;

export default function AnalyzePage() {
  const [sideBarOpen, setSideBarOpen] = useState(false);
  const chatInputRef = useRef<ChatInputHandle>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm SEC Fault, your AI assistant here to help you navigate the world of SEC filings and financial reports.",
      suggestions: [
        "Summarize Apple's latest 10-K",
        "What are Tesla's key risks?",
        "Explain Microsoft's revenue trends",
      ],
    },
  ]);

  const handleNewMessage = (userMessage: Message, assistantMessage: Message) => {
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
  };

  // When a pill is clicked, send it as a message directly
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

      {sideBarOpen && <Sidebar toggleSidebar={() => setSideBarOpen(false)} />}

      <main className="flex flex-1 flex-col">
        <ChatMessages messages={messages} onSuggestionClick={handleSuggestionClick} />
        <ChatInput ref={chatInputRef} chatId={CHAT_ID} onNewMessage={handleNewMessage} />
      </main>
    </div>
  );
}