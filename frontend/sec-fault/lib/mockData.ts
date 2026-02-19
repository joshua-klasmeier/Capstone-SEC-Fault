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

export interface FilingHistory {
  id: string;
  company: string;
  ticker: string;
  filingType: string;
  date: string;
  summary: string;
  fullSummary?: string;
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

export const filingHistory: FilingHistory[] = [
  {
    id: "1",
    company: "Apple Inc.",
    ticker: "AAPL",
    filingType: "10-K",
    date: "2025-11-01",
    summary: "Apple reported record revenue of $394.3B for fiscal 2025, driven by strong iPhone 16 sales and services growth...",
    fullSummary: "Apple Inc. filed its annual 10-K report showing record revenue of $394.3 billion for fiscal year 2025. The report highlights strong performance across all product categories, with iPhone revenue up 12% year-over-year."
  },
  {
    id: "2",
    company: "Tesla Inc.",
    ticker: "TSLA",
    filingType: "10-Q",
    date: "2025-10-24",
    summary: "Tesla's Q3 2025 quarterly report shows 15% revenue growth with expanded production capacity...",
    fullSummary: "Tesla's third quarter 2025 10-Q filing reveals continued growth in vehicle deliveries and energy storage deployments."
  },
  {
    id: "3",
    company: "Microsoft Corporation",
    ticker: "MSFT",
    filingType: "8-K",
    date: "2025-10-15",
    summary: "Microsoft announced a major acquisition in the AI sector through this current report filing...",
    fullSummary: "Microsoft filed an 8-K current report disclosing a significant acquisition aimed at expanding its AI capabilities."
  },
  {
    id: "4",
    company: "Amazon.com Inc.",
    ticker: "AMZN",
    filingType: "10-Q",
    date: "2025-10-10",
    summary: "Amazon's Q3 results show strong AWS growth with 18% year-over-year cloud revenue increase...",
    fullSummary: "Amazon's quarterly report demonstrates robust performance in cloud computing and e-commerce segments."
  },
  {
    id: "5",
    company: "Alphabet Inc.",
    ticker: "GOOGL",
    filingType: "10-K",
    date: "2025-02-04",
    summary: "Google's parent company reported $307B in annual revenue with advertising and cloud as key drivers...",
    fullSummary: "Alphabet's annual report shows consistent growth in search advertising and Google Cloud Platform services."
  },
];
