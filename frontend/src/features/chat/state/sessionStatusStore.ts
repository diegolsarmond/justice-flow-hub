import { useSyncExternalStore } from "react";

export type SessionConnectionStatus = "connected" | "connecting" | "disconnected";

export interface SessionStatusEntry {
  credentialId: string;
  empresaId: number | null;
  status: SessionConnectionStatus;
  metadata?: Record<string, unknown>;
  updatedAt: string;
}

interface SessionStatusState {
  sessions: Record<string, SessionStatusEntry>;
}

let state: SessionStatusState = { sessions: {} };

const listeners = new Set<() => void>();

const emitChange = () => {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn("Falha ao notificar listener de status da sessão", error);
    }
  }
};

export const setSessionStatusEntry = (entry: SessionStatusEntry) => {
  state = {
    sessions: {
      ...state.sessions,
      [entry.credentialId]: entry,
    },
  };
  emitChange();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => state;

export const useSessionStatusStore = () => useSyncExternalStore(subscribe, getSnapshot);
