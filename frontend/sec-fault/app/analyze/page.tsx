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
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [backgroundImagePath, setBackgroundImagePath] = useState(
    "backend/public/Sec_file_static_image.png"
  );
  const [avatarImagePath, setAvatarImagePath] = useState(
    "backend/public/neutral_peter_avatar.png"
  );
  const [enableDynamicAvatar, setEnableDynamicAvatar] = useState(true);
  const [videoPanelOpen, setVideoPanelOpen] = useState(false);
  const [videoSourceMessageId, setVideoSourceMessageId] = useState<string | null>(null);
  const [videoScriptOverride, setVideoScriptOverride] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoScript, setVideoScript] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
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

  const handleVideoClick = (message: Message) => {
    if (message.role !== "assistant" || !message.content.trim() || message.id === "greeting") {
      return;
    }
    setVideoPanelOpen(true);
    setVideoSourceMessageId(message.id);
    setVideoScriptOverride(message.content);
    setVideoError(null);
  };

  const closeVideoPanel = () => {
    setVideoPanelOpen(false);
    setVideoSourceMessageId(null);
  };

  const handleGenerateVideo = async () => {
    setVideoLoading(true);
    setVideoError(null);

    try {
      if (!videoScriptOverride.trim()) {
        throw new Error("Select an assistant response first.");
      }

      const payload = {
        script_text: videoScriptOverride.trim() || null,
        background_image_path: backgroundImagePath.trim() || null,
        avatar_image_path: avatarImagePath.trim() || null,
        enable_dynamic_avatar: enableDynamicAvatar,
        tts_provider: "edge",
        tts_voice: "en-US-GuyNeural",
      };

      // 1. Submit the job
      const submitRes = await fetch(apiUrl("/video/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!submitRes.ok) {
        const text = await submitRes.text();
        throw new Error(text || "Video generation failed");
      }
      const { job_id } = await submitRes.json();

      // 2. Poll until complete
      let status = "processing";
      while (status === "processing") {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(apiUrl(`/video/jobs/${job_id}`), {
          credentials: "include",
        });
        if (!pollRes.ok) throw new Error("Failed to check video status");
        const pollData = await pollRes.json();
        status = pollData.status;
        if (status === "failed") {
          throw new Error(pollData.error || "Video generation failed");
        }
      }

      // 3. Download the finished video
      const dlRes = await fetch(apiUrl(`/video/jobs/${job_id}/download`), {
        credentials: "include",
      });
      if (!dlRes.ok) throw new Error("Failed to download video");

      const blob = await dlRes.blob();
      if (!blob.size) {
        throw new Error("Received empty video response");
      }

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;

      setVideoScript(videoScriptOverride.trim());
      setVideoUrl(objectUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Video generation failed";
      setVideoError(message);
    } finally {
      setVideoLoading(false);
    }
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
          onVideoClick={handleVideoClick}
          onRegenerate={(userMessage) => {
            if (chatInputRef.current) {
              handleSuggestionClick(userMessage);
            }
          }}
        />

        {videoPanelOpen && (
          <section className="border-t border-border px-6 py-4">
            <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-text-primary">
                  Generate Video From This Response
                </h2>
                <button
                  type="button"
                  onClick={closeVideoPanel}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-background"
                >
                  Close
                </button>
              </div>

              {videoSourceMessageId && (
                <p className="mt-2 text-xs text-text-secondary">
                  Source message: {videoSourceMessageId}
                </p>
              )}

              <textarea
                value={videoScriptOverride}
                onChange={(e) => setVideoScriptOverride(e.target.value)}
                className="mt-3 h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none"
                placeholder="Edit script before generating"
              />

              <div className="mt-3 grid gap-2">
                <input
                  value={backgroundImagePath}
                  onChange={(e) => setBackgroundImagePath(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none"
                  placeholder="Background image path (example: backend/public/Sec_file_static_image.png)"
                />
                <input
                  value={avatarImagePath}
                  onChange={(e) => setAvatarImagePath(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-text-primary outline-none"
                  placeholder="Static avatar path fallback (example: backend/public/neutral_peter_avatar.png)"
                />
                <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-text-primary">
                  <input
                    type="checkbox"
                    checked={enableDynamicAvatar}
                    onChange={(e) => setEnableDynamicAvatar(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  Enable dynamic expressions (neutral/positive/concerned)
                </label>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateVideo}
                  disabled={videoLoading}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {videoLoading ? "Generating..." : "Generate Video"}
                </button>
                {videoError && (
                  <p className="text-xs text-red-500">{videoError}</p>
                )}
              </div>

              {videoScript && (
                <p className="mt-3 text-xs text-text-secondary">
                  <span className="font-medium text-text-primary">Script:</span>{" "}
                  {videoScript}
                </p>
              )}

              {videoUrl && (
                <div className="mt-3">
                  <video
                    key={videoUrl}
                    controls
                    className="w-full rounded-xl border border-border bg-black"
                    src={videoUrl}
                  />
                  <div className="mt-2 flex items-center gap-3 text-xs text-text-secondary">
                    <a
                      href={videoUrl}
                      download
                      className="underline hover:opacity-80"
                    >
                      Download video
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
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
