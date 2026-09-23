/**
 * Auth store using Zustand.
 * Manages authentication state for the mobile app.
 */
import { create } from "zustand";
import * as SecureStore from "@/lib/storage";
import { api, TOKEN_KEY, REFRESH_KEY } from "@/lib/api";

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
        const res = await api.get("/users/me");
        set({ user: res.data.data, isAuthenticated: true });
      }
    } catch {
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
    await SecureStore.setItemAsync(TOKEN_KEY, tokens.access_token);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (refreshToken) {
      try {
        await api.post("/auth/logout", { refresh_token: refreshToken });
      } catch {}
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    set({ user: null, isAuthenticated: false });
  },
}));
