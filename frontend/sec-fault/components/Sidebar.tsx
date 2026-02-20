"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, History, Plus } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { 
      href: "/", 
      label: "Home", 
      icon: Home
    },
    { 
      href: "/filings", 
      label: "SEC Filings", 
      icon: FileText
    },
    { 
      href: "/history", 
      label: "History", 
      icon: History
    },
  ];

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-border bg-sidebar">
      {/* Branding */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <FileText className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-semibold text-text-primary">
          SEC Fault
        </span>
      </div>

      {/* New Analysis Button */}
      <div className="px-3 pb-4">
        <Link
          href="/analyze"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Analysis
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-surface text-text-primary shadow-sm"
                    : "text-text-secondary hover:bg-surface hover:text-text-primary"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

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
