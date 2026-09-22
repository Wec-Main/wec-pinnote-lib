import type { Epic, EpicNote, UserStory } from "../types/epicFlow.types";

export const EPIC_FLOW_SEED_EPICS: Epic[] = [
  {
    id: "epic-ai-shopping",
    title: "AI-Powered Shopping Experience",
    description: "Personalized product discovery using AI.",
  },
  {
    id: "epic-checkout",
    title: "Streamlined Checkout",
    description: "Reduce friction from cart to confirmation.",
  },
  {
    id: "epic-loyalty",
    title: "Loyalty & Rewards",
    description: "Keep customers coming back with tiered perks.",
  },
];

export const EPIC_FLOW_SEED_STORIES: UserStory[] = [
  {
    id: "story-personalized-recs",
    epicId: "epic-ai-shopping",
    title: "As a customer, I want personalized recommendations",
    description: "Surface products based on browsing and purchase history.",
    status: "in-progress",
    assignee: "Sarath",
  },
  {
    id: "story-visual-search",
    epicId: "epic-ai-shopping",
    title: "As a customer, I want to search using a photo",
    status: "todo",
  },
  {
    id: "story-smart-sizing",
    epicId: "epic-ai-shopping",
    title: "As a customer, I want AI-assisted size suggestions",
    status: "todo",
    assignee: "Priya",
  },
  {
    id: "story-one-click-checkout",
    epicId: "epic-checkout",
    title: "As a customer, I want one-click checkout",
    status: "done",
    assignee: "Kavi",
  },
  {
    id: "story-guest-checkout",
    epicId: "epic-checkout",
    title: "As a customer, I want to check out without an account",
    status: "in-progress",
  },
];

export const EPIC_FLOW_SEED_NOTES: EpicNote[] = [
  {
    id: "note-go-big",
    epicId: "epic-ai-shopping",
    title: "Go big (or go home).",
    content: "Think bold, differentiated experiences that make shopping feel magical.",
    createdBy: "Sarath",
    createdAt: "2026-09-18T10:00:00.000Z",
    updatedAt: "2026-09-18T10:00:00.000Z",
  },
  {
    id: "note-model-choice",
    epicId: "epic-ai-shopping",
    title: "Model choice",
    content: "Evaluate a hosted recommendation API before building anything in-house.",
    createdBy: "Priya",
    createdAt: "2026-09-19T14:30:00.000Z",
    updatedAt: "2026-09-19T14:30:00.000Z",
  },
  {
    id: "note-checkout-metrics",
    epicId: "epic-checkout",
    title: "Baseline metrics",
    content: "Current cart abandonment sits at 68% — track weekly once shipped.",
    createdBy: "Kavi",
    createdAt: "2026-09-20T09:15:00.000Z",
    updatedAt: "2026-09-20T09:15:00.000Z",
  },
];
