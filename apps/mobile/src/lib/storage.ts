import { Platform } from 'react-native';
import * as ExpoSecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web' || typeof window !== 'undefined';

export async function setItemAsync(key: string, value: string) {
  if (isWeb) {
    try { localStorage.setItem(key, value); } catch (e) {}
    return;
  }
  try { await ExpoSecureStore.setItemAsync(key, value); } catch (e) {}
}

export async function getItemAsync(key: string) {
  if (isWeb) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  try {
    return await ExpoSecureStore.getItemAsync(key);
  } catch (e) {
    return null;
  }
}

export async function deleteItemAsync(key: string) {
  if (isWeb) {
    try { localStorage.removeItem(key); } catch (e) {}
    return;
  }
  try { await ExpoSecureStore.deleteItemAsync(key); } catch (e) {}
}
