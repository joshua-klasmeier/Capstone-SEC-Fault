"use client";

import Sidebar from "@/components/Sidebar";
import ChatMessages, { Message } from "@/components/ChatMessages";
import ChatInput, { ChatInputHandle } from "@/components/ChatInput";
import { apiUrl } from "@/lib/api";
import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";

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
  const sentPromptRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [conversations, setConversations] = useState<
    { id: string; title: string | null; created_at: string }[]
  >([]);

  // Fetch user's conversation list
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/chats"), { credentials: "include" });
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

  // Auto-send initial prompt from example pills
  useEffect(() => {
    const initialPrompt = sessionStorage.getItem('initialPrompt');
    if (initialPrompt) {
      sessionStorage.removeItem('initialPrompt');
    
      setTimeout(() => {
        chatInputRef.current?.sendMessage(initialPrompt);
      }, 500);
    }
  }, []);

  // Load chat from ?chat= query param (e.g. coming from history page)
  useEffect(() => {
    const chatParam = searchParams.get("chat");
    if (chatParam && chatParam !== chatId) {
      loadChat(chatParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // If arriving from home with ?prompt=..., send it once as the first message.
  useEffect(() => {
    const promptParam = searchParams.get("prompt")?.trim();
    const chatParam = searchParams.get("chat");
    if (!promptParam || chatParam) return;

    if (sentPromptRef.current === promptParam) return;
    sentPromptRef.current = promptParam;

    chatInputRef.current?.sendMessage(promptParam);
  }, [searchParams]);

  // Create a new conversation on the backend, return the id
  const ensureChat = async (): Promise<string> => {
    if (chatId) return chatId;

    const res = await fetch(apiUrl("/chats"), {
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
      const res = await fetch(apiUrl(`/chats/${id}`), {
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
    setLoading(false);
    loadConversations();
  };

  const sendMessageToGemini = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const thinkingMessageId = (Date.now() + 0.5).toString();
    const thinkingMessage: Message = {
      id: thinkingMessageId,
      role: "assistant",
      content: "...",
    };
    
    setMessages((prev) => [...prev, thinkingMessage]);


    try {
      const activeId = chatId ?? (await ensureChat());

      const response = await fetch(apiUrl(`/chats/${activeId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text }),
      });

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

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === thinkingMessageId ? assistantMessage : msg
        )
      );
      loadConversations();
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === thinkingMessageId ? errorMessage : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (text: string) => {
    sendMessageToGemini(text);
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
        <ChatMessages
          messages={messages}
          loading={loading}
          onSuggestionClick={handleSuggestionClick}
          onRegenerate={(userMessage) => {
            if (chatInputRef.current) {
              handleSuggestionClick(userMessage);
            }
          }}
        />

        <ChatInput
          ref={chatInputRef}
          chatId={chatId}
          ensureChat={ensureChat}
          onNewMessage={handleNewMessage}
          onSendMessage={sendMessageToGemini}
        />
      </main>
    </div>
  );
}
