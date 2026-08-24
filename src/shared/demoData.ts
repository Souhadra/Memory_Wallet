import type { AIApplication, MemoryCategory, Profile } from "./types";
import { DEMO_MARKER } from "./constants";

export const DEFAULT_AI_APPS: AIApplication[] = [
  { id: "chatgpt", name: "ChatGPT", domain: "chatgpt.com" },
  { id: "claude", name: "Claude", domain: "claude.ai" },
];

export function createDefaultProfiles(): Profile[] {
  const t = new Date().toISOString();
  return [
    {
      id: "profile_personal",
      name: "Personal",
      description: "Everyday personal context.",
      icon: "🏠",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: "profile_work",
      name: "Work",
      description: "Professional context for your job.",
      icon: "💼",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: "profile_startup",
      name: "Startup",
      description: "Context for your startup project.",
      icon: "🚀",
      createdAt: t,
      updatedAt: t,
    },
  ];
}

export interface DemoMemorySpec {
  content: string;
  category: MemoryCategory;
  importance: number;
}

export const DEMO_DATA: Record<string, DemoMemorySpec[]> = {
  Startup: [
    { content: "I am building an AI Memory Wallet.", category: "project", importance: 0.9 },
    {
      content:
        "The goal is to make AI memory portable across different LLMs.",
      category: "goal",
      importance: 0.85,
    },
    { content: "I prefer privacy-first architecture.", category: "preference", importance: 0.9 },
    {
      content: "I prefer simple architecture over unnecessary abstractions.",
      category: "preference",
      importance: 0.8,
    },
    {
      content:
        "I am currently experimenting with React, TypeScript and Python.",
      category: "technical",
      importance: 0.85,
    },
  ],
  Work: [
    { content: "I work primarily with Python.", category: "work", importance: 0.8 },
    {
      content: "I have experience building RAG systems.",
      category: "technical",
      importance: 0.7,
    },
    {
      content: "I prefer concise technical explanations.",
      category: "preference",
      importance: 0.75,
    },
  ],
  Personal: [{ content: "Prefer concise answers.", category: "personal", importance: 0.6 }],
};

export function demoDescription(): string {
  return `${DEMO_MARKER} Sample data loaded via "Load Demo Data". Safe to delete.`;
}
