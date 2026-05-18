import { create } from "zustand";

import { setApiSessionToken } from "../services/api";
import { storage } from "../services/storage";
import type { TelegramSessionUser } from "../types/api";

const sessionStorageKey = "telegram-miniapp:session-token";

interface SessionState {
  sessionToken: string | null;
  user: TelegramSessionUser | null;
  isBootstrapping: boolean;
  setSession: (token: string | null, user?: TelegramSessionUser | null) => void;
  setBootstrapping: (value: boolean) => void;
  clearSession: () => void;
}

const initialToken = storage.getString(sessionStorageKey);
setApiSessionToken(initialToken);

export const useSessionStore = create<SessionState>((set) => ({
  sessionToken: initialToken,
  user: null,
  isBootstrapping: true,
  setSession: (sessionToken, user = null) => {
    if (sessionToken) {
      storage.setString(sessionStorageKey, sessionToken);
    } else {
      storage.remove(sessionStorageKey);
    }
    setApiSessionToken(sessionToken);
    set({ sessionToken, user, isBootstrapping: false });
  },
  setBootstrapping: (isBootstrapping) => set({ isBootstrapping }),
  clearSession: () => {
    storage.remove(sessionStorageKey);
    setApiSessionToken(null);
    set({ sessionToken: null, user: null, isBootstrapping: false });
  },
}));
