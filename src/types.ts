export type ReflectionMode = 'reflection' | 'brainstorm' | 'summary' | 'action_items' | 'chat';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: ReflectionMode;
  takeaways?: string[];
  suggestedQuestions?: string[];
}

export interface ReflectionEntry {
  id: string;
  userId: string;
  title: string;
  primaryPrompt: string;
  messages: ChatMessage[];
  summary: string;
  takeaways: string[];
  tags: string[];
  geo?: { lat: number; lng: number };
  mode: ReflectionMode;
  pinned: boolean;
  embedding?: any;
  embeddingUpdatedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SearchMatch {
  id: string;
  title: string;
  summary: string;
  score: number;
}

export interface RecommendationSuggestion {
  title: string;
  reason: string;
  category: string;
  resourceLink?: string;
}

export interface RecommendationBatch {
  id: string;
  userId: string;
  suggestions: RecommendationSuggestion[];
  createdAt: number;
}

export type Recommendation = RecommendationBatch;

export interface GeminiReflectRequest {
  prompt: string;
  mode: ReflectionMode;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  tags?: string[];
  title?: string;
}

export interface GeminiReflectResponse {
  content: string;
  title: string;
  summary: string;
  takeaways: string[];
  suggestedQuestions: string[];
  modelUsed: string;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
}

export type AppUser = UserProfile;

