import { create } from 'zustand';

export type Role = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  /** True while the assistant message is still streaming. */
  pending?: boolean;
}

export type ChatStatus = 'idle' | 'thinking' | 'streaming' | 'speaking' | 'error';
export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'relaxed';
export type ModelStatus = 'empty' | 'loading' | 'ready' | 'error';
export type ModelSource =
  | { kind: 'url'; url: string; name?: string }
  | { kind: 'file'; file: File };

let idCounter = 0;
const nextId = () => `m${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

interface NovaState {
  // chat
  messages: ChatMessage[];
  status: ChatStatus;
  error: string | null;
  // voice / mic
  voiceEnabled: boolean;
  micEnabled: boolean;
  // emotion target (the render loop blends VRM expressions toward this)
  emotion: Emotion;
  // model
  modelSource: ModelSource | null;
  modelStatus: ModelStatus;
  modelError: string | null;
  modelName: string | null;

  // actions
  addUserMessage: (content: string) => void;
  startAssistantMessage: () => string;
  appendToMessage: (id: string, delta: string) => void;
  finalizeMessage: (id: string) => void;
  setStatus: (s: ChatStatus) => void;
  setError: (e: string | null) => void;
  setEmotion: (e: Emotion) => void;
  setVoiceEnabled: (v: boolean) => void;
  setMicEnabled: (v: boolean) => void;
  setModelSource: (s: ModelSource | null) => void;
  setModelStatus: (s: ModelStatus, error?: string | null) => void;
  setModelName: (name: string | null) => void;
  clearChat: () => void;
}

export const useStore = create<NovaState>((set) => ({
  messages: [],
  status: 'idle',
  error: null,
  voiceEnabled: true,
  micEnabled: false,
  emotion: 'neutral',
  modelSource: null,
  modelStatus: 'empty',
  modelError: null,
  modelName: null,

  addUserMessage: (content) =>
    set((s) => ({ messages: [...s.messages, { id: nextId(), role: 'user', content }] })),

  startAssistantMessage: () => {
    const id = nextId();
    set((s) => ({
      messages: [...s.messages, { id, role: 'assistant', content: '', pending: true }],
    }));
    return id;
  },

  appendToMessage: (id, delta) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
    })),

  finalizeMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, pending: false } : m)),
    })),

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),
  setEmotion: (emotion) => set({ emotion }),
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setMicEnabled: (micEnabled) => set({ micEnabled }),
  setModelSource: (modelSource) => set({ modelSource }),
  setModelStatus: (modelStatus, modelError = null) => set({ modelStatus, modelError }),
  setModelName: (modelName) => set({ modelName }),
  clearChat: () => set({ messages: [], status: 'idle', error: null }),
}));
