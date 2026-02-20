"use client";

import { messages, conversationTitle } from "@/lib/mockData";
import { Copy, ThumbsUp, ThumbsDown, RotateCw } from "lucide-react";

function renderBoldText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function ChatMessages() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Title Bar */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">
          {conversationTitle}
        </h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.map((msg) =>
            msg.role === "user" ? (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-md bg-user-bubble px-4 py-3 text-sm leading-relaxed text-white">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex flex-col gap-2">
                <div className="max-w-[85%] text-sm leading-relaxed text-text-primary">
                  {msg.content.split("\n").map((line, i) => (
                    <p key={i} className={line === "" ? "h-3" : ""}>
                      {renderBoldText(line)}
                    </p>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-border hover:text-text-primary">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-border hover:text-text-primary">
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-border hover:text-text-primary">
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                  <button className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-border hover:text-text-primary">
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
