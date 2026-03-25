"use client";

import { useState, forwardRef, useImperativeHandle } from "react";
import { ArrowUp } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
}

interface ChatInputProps {
  chatId: string | null;
  ensureChat: () => Promise<string>;
  onNewMessage: (userMessage: Message, assistantMessage: Message) => void;
}

export interface ChatInputHandle {
  sendMessage: (text: string) => void;
}

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  ({ chatId, ensureChat, onNewMessage }, ref) => {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);

    const sendMessage = async (text: string) => {
      if (!text.trim()) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text,
      };

      setLoading(true);
      setValue("");

      try {
        // Create conversation if this is the first message
        const activeId = chatId ?? (await ensureChat());

        const response = await fetch(
          `${API_URL}/chats/${activeId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ message: text }),
          }
        );

        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        const data = await response.json();

        const assistantMessage: Message = {
          id: data.assistant_message?.id ?? (Date.now() + 1).toString(),
          role: "assistant",
          content: data.msg_reply,
          suggestions: data.suggested_queries || [],
        };

        onNewMessage(userMessage, assistantMessage);
      } catch (error) {
        console.error("Error sending message:", error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        };
        onNewMessage(userMessage, errorMessage);
      } finally {
        setLoading(false);
      }
    };

    useImperativeHandle(ref, () => ({ sendMessage }));

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(value);
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
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </form>

          {loading && (
            <p className="mt-2 text-center text-xs text-text-secondary">
              Thinking...
            </p>
          )}

          <p className="mt-2 text-center text-xs text-text-secondary">
            SEC Fault may produce inaccurate summaries. Verify with original SEC filings.
          </p>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = "ChatInput";
export default ChatInput;
