export const getSupabaseClient = jest.fn(() => ({
  auth: {
    signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
    verifyOtp: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
  },
}));
