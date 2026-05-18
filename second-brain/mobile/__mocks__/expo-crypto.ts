export const CryptoDigestAlgorithm = {
  SHA256: "SHA-256",
};

export const randomUUID = jest.fn().mockReturnValue("mock-uuid-1234");

export const digestStringAsync = jest
  .fn()
  .mockResolvedValue("mock-hashed-nonce-abcdef1234");
