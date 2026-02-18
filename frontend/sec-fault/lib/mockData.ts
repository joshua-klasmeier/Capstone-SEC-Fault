export interface HistoryItem {
  id: string;
  title: string;
  active?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const chatHistory: HistoryItem[] = [
  { id: "1", title: "Example Chat", active: true },
];

export const conversationTitle = "Example Chat";

export const messages: Message[] = [
  {
    id: "m1",
    role: "user",
    content: "Example text",
  },
  {
    id: "m2",
    role: "assistant",
    content: "Example text",
  },
];
