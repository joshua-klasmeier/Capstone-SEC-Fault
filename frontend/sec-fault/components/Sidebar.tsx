"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, FileText, History, Plus } from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SidebarUser = {
  name: string | null;
  email: string | null;
};

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<SidebarUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
        });
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        if (data?.user) {
          setUser({
            name: data.user.name ?? null,
            email: data.user.email ?? null,
          });
        }
      } catch {
        // Ignore auth errors in sidebar.
      }
    }

    fetchUser();
  }, []);

  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: Home,
    },
    {
      href: "/filings",
      label: "SEC Filings",
      icon: FileText,
    },
    {
      href: "/history",
      label: "History",
      icon: History,
    },
  ];

  const initials = (() => {
    const source = user?.name || user?.email;
    if (!source) return "U";
    const parts = source.split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  })();

  async function handleLogout() {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore network errors on logout.
    } finally {
      setUser(null);
      setMenuOpen(false);
    }
  }

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

      {/* Footer Links */}
      <div className="px-3 pb-3 border-t border-border pt-3">
        <div className="flex flex-col gap-1">
          <Link
            href="/about"
            className={`px-3 py-2 text-xs font-medium transition-colors rounded-lg ${
              pathname === "/about"
                ? "text-text-primary bg-surface"
                : "text-text-secondary hover:text-text-primary hover:bg-surface"
            }`}
          >
            About Us
          </Link>
          <Link
            href="/terms"
            className={`px-3 py-2 text-xs font-medium transition-colors rounded-lg ${
              pathname === "/terms"
                ? "text-text-primary bg-surface"
                : "text-text-secondary hover:text-text-primary hover:bg-surface"
            }`}
          >
            Terms & Conditions
          </Link>
        </div>
      </div>

      {/* User Profile / Login */}
      <div className="border-t border-border px-4 py-3">
        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-surface"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-medium text-white">
                {initials}
              </div>
              <span className="text-sm font-medium text-text-primary">
                {user.name ?? user.email}
              </span>
            </button>
            {menuOpen && (
              <div className="absolute bottom-11 left-0 w-40 rounded-lg border border-border bg-surface shadow-lg">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-sidebar"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Login with Google
          </Link>
        )}
      </div>
    </aside>
  );
}
