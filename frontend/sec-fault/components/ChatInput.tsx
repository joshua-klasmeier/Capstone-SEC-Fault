"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInputProps {
  onNewMessage: (userMessage: Message, assistantMessage: Message) => void;
}

export default function ChatInput({ onNewMessage }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: value
    };

    try {
      const response = await fetch(`${API_URL}/chats/1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ message: value }),
      });

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.msg_reply
      };

      onNewMessage(userMessage, assistantMessage);
      setValue("");
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      
      onNewMessage(userMessage, errorMessage);
    } finally {
    }
  };

  return (
    <div className="border-t border-border px-6 pb-4 pt-3">
      <div className="mx-auto max-w-3xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Reply to SEC Fault..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
            />
            <button 
              type="submit"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>
        <p className="mt-2 text-center text-xs text-text-secondary">
          SEC Fault may produce inaccurate summaries. Verify with original SEC
          filings.
        </p>
      </div>
    </div>
  );
}