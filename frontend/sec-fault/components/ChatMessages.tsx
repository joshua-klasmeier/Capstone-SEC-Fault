import { messages, conversationTitle } from "@/lib/mockData";

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

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ThumbsUpIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
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
                    <CopyIcon />
                  </button>
                  <button className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-border hover:text-text-primary">
                    <ThumbsUpIcon />
                  </button>
                  <button className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-border hover:text-text-primary">
                    <ThumbsDownIcon />
                  </button>
                  <button className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-border hover:text-text-primary">
                    <RetryIcon />
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
