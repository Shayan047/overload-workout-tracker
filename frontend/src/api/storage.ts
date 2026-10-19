import AsyncStorage from '@react-native-async-storage/async-storage';

/** On-device key-value storage. The outbox and cache use this, not a local database. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const deviceStorage: KeyValueStorage = AsyncStorage;
