import Sidebar from "@/components/Sidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";

export default function Home() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex flex-1 flex-col">
        <ChatMessages />
        <ChatInput />
      </main>
    </div>
  );
}
