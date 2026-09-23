/**
 * Auth store using Zustand.
 * Manages authentication state for the mobile app.
 */
import { create } from "zustand";
import * as SecureStore from "@/lib/storage";
import { api, TOKEN_KEY, REFRESH_KEY, setAuthToken } from "@/lib/api";

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        setAuthToken(token);
        const res = await api.get("/users/me");
        set({ user: res.data.data, isAuthenticated: true });
      }
    } catch {
      setAuthToken(null);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const { tokens, user } = res.data.data;
    setAuthToken(tokens.access_token);
    await SecureStore.setItemAsync(TOKEN_KEY, tokens.access_token);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token);

    // Fetch full profile (includes role, permissions, and organization details)
    try {
      const meRes = await api.get("/users/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      set({ user: meRes.data.data, isAuthenticated: true });
    } catch {
      set({ user, isAuthenticated: true });
    }
  },

  logout: async () => {
    setAuthToken(null);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    // Purge local storage immediately
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    set({ user: null, isAuthenticated: false });

    // Revoke token on server in background (fire-and-forget)
    if (refreshToken) {
      api.post("/auth/logout", { refresh_token: refreshToken }).catch(() => {});
    }
  },
}));
