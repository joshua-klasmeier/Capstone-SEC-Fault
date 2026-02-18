import { chatHistory } from "@/lib/mockData";

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-72 flex-col border-r border-border bg-sidebar">
      {/* Branding */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <span className="text-lg font-semibold text-text-primary">
          SEC Fault
        </span>
      </div>

      {/* New Chat Button */}
      <div className="px-3 py-2">
        <button className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New chat
        </button>
      </div>

      {/* Recents */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
          Recents
        </p>
        <nav className="flex flex-col gap-0.5">
          {chatHistory.map((item) => (
            <a
              key={item.id}
              href="#"
              className={`block truncate rounded-lg px-3 py-2 text-sm transition-colors ${
                item.active
                  ? "bg-surface font-medium text-text-primary"
                  : "text-text-secondary hover:bg-surface hover:text-text-primary"
              }`}
            >
              {item.title}
            </a>
          ))}
        </nav>
      </div>

      {/* User Profile */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-medium text-white">
            JK
          </div>
          <span className="text-sm font-medium text-text-primary">
            Josh K.
          </span>
        </div>
      </div>
    </aside>
  );
}
