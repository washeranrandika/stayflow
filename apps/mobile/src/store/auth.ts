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
  selectedPropertyId: string;
  setSelectedPropertyId: (id: string) => void;
  setUser: (user: any) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { full_name: string; email: string; password: string; hotel_name?: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  selectedPropertyId: "all",
  setSelectedPropertyId: (id: string) => set({ selectedPropertyId: id }),
  setUser: (user: any) => {
    const assignedPropId = user?.assigned_property_id;
    set({
      user,
      selectedPropertyId: assignedPropId || get().selectedPropertyId || "all",
    });
  },

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        setAuthToken(token);
        const res = await api.get("/users/me");
        const userData = res.data.data;
        set({
          user: userData,
          isAuthenticated: true,
          selectedPropertyId: userData?.assigned_property_id || "all",
        });
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
      const userData = meRes.data.data;
      set({
        user: userData,
        isAuthenticated: true,
        selectedPropertyId: userData?.assigned_property_id || "all",
      });
    } catch {
      set({
        user,
        isAuthenticated: true,
        selectedPropertyId: user?.assigned_property_id || "all",
      });
    }
  },

  register: async (registerData) => {
    const res = await api.post("/auth/register", registerData);
    const { tokens, user } = res.data.data;
    setAuthToken(tokens.access_token);
    await SecureStore.setItemAsync(TOKEN_KEY, tokens.access_token);
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token);

    try {
      const meRes = await api.get("/users/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userData = meRes.data.data;
      set({
        user: userData,
        isAuthenticated: true,
        selectedPropertyId: userData?.assigned_property_id || "all",
      });
    } catch {
      set({
        user,
        isAuthenticated: true,
        selectedPropertyId: user?.assigned_property_id || "all",
      });
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
