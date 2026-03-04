"use client";

import Sidebar from "@/components/Sidebar";
import { Users, Target, Code, GraduationCap, Menu } from "lucide-react";
import { useState } from "react";


export default function AboutPage() {
  const teamMembers = [
    "Joshua Klasmeier",
    "Ayush Selar",
    "Aarini Shah",
    "Arnav Chennamaneni",
    "Pratham Ujalambkar",
    "Connor Allen",
    "Disha Patel",
  ];

  const features = [
    "Fetches SEC filings using the SEC EDGAR API",
    "Generates plain English, news-style summaries",
    "Uses LLM-powered summarization",
    "Designed for users who want quick financial insights",
  ];

  const techStack = [
    { category: "Frontend", tech: "Next.js, React, TypeScript" },
    { category: "Backend", tech: "Python (FastAPI)" },
    { category: "Database", tech: "PostgreSQL, Qdrant (Vector DB for RAG), Redis" },
    { category: "LLM Provider", tech: "Gemini" },
  ];

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

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-12">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-text-primary mb-4">
              About Us
            </h1>
            <p className="text-lg text-text-secondary">
              Learn more about the Automated Finance Reporting Tool
            </p>
          </div>

          {/* Overview Section */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Target className="h-6 w-6 text-accent" />
              <h2 className="text-2xl font-semibold text-text-primary">
                Overview
              </h2>
            </div>
            <div className="bg-surface border border-border rounded-lg p-6">
              <p className="text-text-primary leading-relaxed">
                This project is an <strong>Automated Finance Reporting Tool</strong> that takes in SEC filings 
                and generates simple, easy-to-read summaries based on user prompts. The goal is to help users 
                stay informed about company financial updates without needing a strong background in finance 
                or accounting.
              </p>
            </div>
          </section>

          {/* Features Section */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <GraduationCap className="h-6 w-6 text-accent" />
              <h2 className="text-2xl font-semibold text-text-primary">
                Features
              </h2>
            </div>
            <div className="bg-surface border border-border rounded-lg p-6">
              <ul className="space-y-3">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3 text-text-primary">
                    <span className="text-accent mt-1">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Tech Stack Section */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Code className="h-6 w-6 text-accent" />
              <h2 className="text-2xl font-semibold text-text-primary">
                Tech Stack
              </h2>
            </div>
            <div className="bg-surface border border-border rounded-lg p-6">
              <div className="grid gap-4">
                {techStack.map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <span className="font-semibold text-accent min-w-[120px]">
                      {item.category}:
                    </span>
                    <span className="text-text-primary">{item.tech}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Team Section */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-6 w-6 text-accent" />
              <h2 className="text-2xl font-semibold text-text-primary">
                Team Members
              </h2>
            </div>
            <div className="bg-surface border border-border rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {teamMembers.map((member, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 text-text-primary"
                  >
                    <div className="h-2 w-2 rounded-full bg-accent"></div>
                    <span>{member}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Course Section */}
          <section>
            <div className="bg-surface border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Course
              </h3>
              <p className="text-text-secondary">
                SP25 CSE 5914 – Knowledge Based Systems
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
