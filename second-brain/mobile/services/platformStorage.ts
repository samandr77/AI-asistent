import { Platform } from "react-native";

type SyncStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function createMemoryStorage(): SyncStorage {
  const memory = new Map<string, string>();

  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
    removeItem: (key) => {
      memory.delete(key);
    },
  };
}

function getWebLocalStorage(): Storage | null {
  if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) {
    return null;
  }

  return globalThis.localStorage;
}

function createNativeStorage(id: string): SyncStorage | null {
  if (Platform.OS === "web") {
    return null;
  }

  const { createMMKV } =
    require("react-native-mmkv") as typeof import("react-native-mmkv");
  const storage = createMMKV({ id });

  return {
    getItem: (key) => storage.getString(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
    removeItem: (key) => {
      storage.remove(key);
    },
  };
}

export function createSyncStorage(id: string): SyncStorage {
  const nativeStorage = createNativeStorage(id);
  if (nativeStorage) {
    return nativeStorage;
  }

  const webStorage = getWebLocalStorage();
  if (!webStorage) {
    return createMemoryStorage();
  }

  const withPrefix = (key: string) => `${id}:${key}`;

  return {
    getItem: (key) => webStorage.getItem(withPrefix(key)),
    setItem: (key, value) => {
      webStorage.setItem(withPrefix(key), value);
    },
    removeItem: (key) => {
      webStorage.removeItem(withPrefix(key));
    },
  };
}

export function createAsyncStorage(id: string): AsyncStorageLike {
  const storage = createSyncStorage(id);

  return {
    getItem: async (key) => storage.getItem(key),
    setItem: async (key, value) => {
      storage.setItem(key, value);
    },
    removeItem: async (key) => {
      storage.removeItem(key);
    },
  };
}
