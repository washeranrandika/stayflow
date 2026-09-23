import { Platform } from 'react-native';
import * as ExpoSecureStore from 'expo-secure-store';

export async function setItemAsync(key: string, value: string) {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (e) {}
    return;
  }
  try {
    await ExpoSecureStore.setItemAsync(key, value);
  } catch (e) {
    console.warn('SecureStore setItem error:', e);
  }
}

export async function getItemAsync(key: string) {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  try {
    return await ExpoSecureStore.getItemAsync(key);
  } catch (e) {
    console.warn('SecureStore getItem error:', e);
    return null;
  }
}

export async function deleteItemAsync(key: string) {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) {}
    return;
  }
  try {
    await ExpoSecureStore.deleteItemAsync(key);
  } catch (e) {
    console.warn('SecureStore deleteItem error:', e);
  }
}
