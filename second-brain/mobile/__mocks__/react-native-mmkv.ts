const store = new Map<string, string>();

export const createMMKV = jest.fn(() => ({
  getString: jest.fn((key: string) => store.get(key) ?? undefined),
  set: jest.fn((key: string, value: string) => {
    store.set(key, value);
  }),
  remove: jest.fn((key: string) => {
    store.delete(key);
  }),
}));
