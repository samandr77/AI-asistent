export const supabase = {
  auth: {
    signInWithIdToken: jest.fn(),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
  },
};
