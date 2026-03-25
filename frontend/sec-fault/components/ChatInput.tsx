"use client";

import { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInputProps {
  onNewMessage: (userMessage: Message, assistantMessage: Message) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export default function ChatInput({ onNewMessage, loading, setLoading }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: value
    };

    setValue("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chats/1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ message: userMessage.content }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.msg_reply
      };

      onNewMessage(userMessage, assistantMessage);
    } catch (error) {
      console.error('Error sending message:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };

      onNewMessage(userMessage, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-sm px-6 pb-4 pt-3">
      <div className="mx-auto max-w-3xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-end gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-accent/40">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply to SEC Fault..."
              disabled={loading}
              rows={1}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none resize-none max-h-32 disabled:opacity-50"
              style={{ minHeight: "24px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "24px";
                target.style.height = Math.min(target.scrollHeight, 128) + "px";
              }}
            />
            <button
              type="submit"
              disabled={loading || !value.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
        <p className="mt-2 text-center text-xs text-text-secondary">
          SEC Fault may produce inaccurate summaries. Verify with original SEC filings.
        </p>
      </div>
    </div>
  );
}
