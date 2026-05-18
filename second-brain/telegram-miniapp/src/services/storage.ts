type StorageValue = string | null;

const memoryStorage = new Map<string, string>();

function getBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const storage = {
  getString(key: string): StorageValue {
    const browserStorage = getBrowserStorage();
    if (browserStorage) {
      return browserStorage.getItem(key);
    }
    return memoryStorage.get(key) ?? null;
  },

  setString(key: string, value: string): void {
    const browserStorage = getBrowserStorage();
    if (browserStorage) {
      browserStorage.setItem(key, value);
      return;
    }
    memoryStorage.set(key, value);
  },

  remove(key: string): void {
    const browserStorage = getBrowserStorage();
    if (browserStorage) {
      browserStorage.removeItem(key);
      return;
    }
    memoryStorage.delete(key);
  },

  clearNamespace(prefix: string): void {
    const browserStorage = getBrowserStorage();
    if (browserStorage) {
      for (const key of Object.keys(browserStorage)) {
        if (key.startsWith(prefix)) {
          browserStorage.removeItem(key);
        }
      }
      return;
    }

    for (const key of memoryStorage.keys()) {
      if (key.startsWith(prefix)) {
        memoryStorage.delete(key);
      }
    }
  },
};
