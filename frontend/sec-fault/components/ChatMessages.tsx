"use client";

import { Copy, ThumbsUp, ThumbsDown, RotateCw, Clapperboard } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState } from "react";
import React from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
}

interface ChatMessagesProps {
  messages: Message[];
  onSuggestionClick: (text: string) => void;
  onRegenerate?: (userMessage: string) => void;
  onVideoClick?: (message: Message) => void;
  loading?: boolean;
}

function LoadingIndicator() {
  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-[85%] text-sm leading-relaxed text-text-primary">
        <div className="flex items-center gap-2 py-2">
          <div className="loading-dots flex gap-1.5">
            <span className="dot h-2 w-2 rounded-full bg-accent opacity-60" />
            <span className="dot h-2 w-2 rounded-full bg-accent opacity-60" />
            <span className="dot h-2 w-2 rounded-full bg-accent opacity-60" />
          </div>
          <span className="text-text-secondary text-xs ml-1">Analyzing...</span>
        </div>
      </div>
    </div>
  );
}

export default function ChatMessages({ messages, loading , onSuggestionClick, onRegenerate, onVideoClick }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleThumbsUp = (messageId: string) => {
    console.log('helpful:', messageId);
  };

  const handleThumbsDown = (messageId: string) => {
    console.log('not helpful:', messageId);
  };

  const handleRegenerate = (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex > 0) {
      const userMessage = messages[messageIndex - 1];
      if (userMessage && userMessage.role === 'user' && onRegenerate) {
        console.log('regenerating response for:', userMessage.content);
        onRegenerate(userMessage.content);
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border py-4 pr-6 pl-16 bg-surface/50 backdrop-blur-sm">
        <h1 className="text-lg font-semibold text-text-primary">
          SEC Filing Analysis
        </h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.map((msg) =>
            msg.role === "user" ? (
              <div key={msg.id} className="flex justify-end animate-fade-in">
                <div className="max-w-[75%] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex flex-col gap-2 animate-fade-in">
                {msg.content === "..." ? (
                  <div className="max-w-[85%] text-sm leading-relaxed text-text-primary">
                    <div className="flex items-center gap-2 py-2">
                      <div className="loading-dots flex gap-1.5">
                        <span className="dot h-2 w-2 rounded-full bg-accent opacity-60" />
                        <span className="dot h-2 w-2 rounded-full bg-accent opacity-60" />
                        <span className="dot h-2 w-2 rounded-full bg-accent opacity-60" />
                      </div>
                      <span className="text-text-secondary text-xs ml-1">Analyzing...</span>
                    </div>
                  </div>
              ) : (
                <div className="max-w-[85%] text-sm leading-relaxed text-text-primary prose-container">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-text-primary">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 text-text-primary">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1 text-text-primary">{children}</h3>,
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="pl-1">{children}</li>,
                      code: ({ className, children }) => {
                        const isBlock = className?.includes("language-");
                        if (isBlock) {
                          return (
                            <pre className="my-2 overflow-x-auto rounded-lg bg-[#2D2B28] p-3 text-xs text-white">
                              <code>{children}</code>
                            </pre>
                          );
                        }
                        return (
                          <code className="rounded bg-border/60 px-1.5 py-0.5 text-xs font-mono text-accent">
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => <>{children}</>,
                      blockquote: ({ children }) => (
                        <blockquote className="my-2 border-l-3 border-accent/50 pl-3 text-text-secondary italic">
                          {children}
                        </blockquote>
                      ),
                      table: ({ children }) => (
                        <div className="my-2 overflow-x-auto rounded-lg border border-border">
                          <table className="w-full text-xs">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-sidebar">{children}</thead>,
                      th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-text-primary border-b border-border">{children}</th>,
                      td: ({ children }) => <td className="px-3 py-2 border-b border-border/50">{children}</td>,
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:opacity-80">
                          {children}
                        </a>
                      ),
                      hr: () => <hr className="my-3 border-border" />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}

                {msg.content !== "..." && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {msg.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => onSuggestionClick(s)}
                        className="px-3 py-1 text-xs rounded-full border border-border text-text-secondary hover:bg-accent hover:text-white hover:border-accent transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {msg.content !== "..." && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      title={copiedId === msg.id ? "Copied!" : "Copy message"}
                      className={`rounded-md p-1.5 transition-all ${
                        copiedId === msg.id 
                          ? 'bg-accent/20 text-accent' 
                          : 'text-text-secondary hover:bg-border hover:text-text-primary'
                      }`}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleThumbsUp(msg.id)}
                      title="Like"
                      className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-border hover:text-accent"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => handleThumbsDown(msg.id)}
                      title="Dislike"
                      className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-border hover:text-red-500"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRegenerate(msg.id)}
                      title="Regenerate"
                      className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-border hover:text-text-primary"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onVideoClick?.(msg)}
                      title="Generate video"
                      className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-border hover:text-text-primary"
                    >
                      <Clapperboard className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
