/**
 * StayFlow Mobile API client.
 * Uses Expo SecureStore for token storage (secure).
 */
import axios, { AxiosInstance } from "axios";
import * as SecureStore from "./storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

export const TOKEN_KEY = "sf_access_token";
export const REFRESH_KEY = "sf_refresh_token";

let memoryToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  memoryToken = token;
};

export const getAuthToken = () => memoryToken;

/** Alias used by some screens — same instance as `api`. */
export const apiClient = api;

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = memoryToken || (await SecureStore.getItemAsync(TOKEN_KEY));
  if (token) {
    if (!memoryToken) memoryToken = token;
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single in-flight refresh promise to prevent race condition when multiple requests 401 simultaneously
let refreshPromise: Promise<string | null> | null = null;

const doRefreshToken = async (): Promise<string | null> => {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) {
    setAuthToken(null);
    return null;
  }
  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });
    const { access_token, refresh_token: newRefresh } = res.data.data;
    setAuthToken(access_token);
    await SecureStore.setItemAsync(TOKEN_KEY, access_token);
    await SecureStore.setItemAsync(REFRESH_KEY, newRefresh);
    return access_token;
  } catch (err) {
    setAuthToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    return null;
  } finally {
    refreshPromise = null;
  }
};

// Auto-refresh on 401 & clear stale auth on 403 tenant mismatch
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = doRefreshToken();
      }
      const newAccessToken = await refreshPromise;
      if (newAccessToken) {
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      }
    } else if (
      error.response?.status === 403 &&
      (error.response?.data?.detail === "Not a member of this organization" ||
       error.response?.data?.detail === "Organization not found or inactive")
    ) {
      setAuthToken(null);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    }
    return Promise.reject(error);
  }
);
