"use client";

import Sidebar from "@/components/Sidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import { useState } from "react";
import { Menu} from "lucide-react";



export default function AnalyzePage() {
  const [sideBarOpen, setSideBarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Toggle Button */}
      {!sideBarOpen && (
        <button
        onClick={() => setSideBarOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-accent text-white hover:opacity-90"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}
      
      {sideBarOpen && <Sidebar toggleSidebar={() => setSideBarOpen(false)} />}

      <main className="flex flex-1 flex-col">
        <ChatMessages />
        <ChatInput />
      </main>
    </div>
  );
}
