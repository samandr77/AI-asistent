/**
 * Mobile auth service tests.
 *
 * All native SDK modules are mocked via __mocks__/ directory.
 * Tests verify: happy-path, user-cancel, no-idToken, nonce flow, signOut cleanup.
 */

import { Platform } from "react-native";

// ── Mocks set up before importing the module under test ──────────────────────

jest.mock("../services/api", () => ({
  supabase: {
    auth: {
      signInWithIdToken: jest.fn(),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
}));
jest.mock("expo-apple-authentication");
jest.mock("@react-native-google-signin/google-signin");
jest.mock("expo-crypto");
jest.mock("expo-web-browser");

// Re-import mocks after jest.mock() calls
import * as AppleAuth from "expo-apple-authentication";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../services/api";

// Module under test — imported after mocks
import { signInWithApple, signInWithGoogle, signOut } from "../services/auth";

const MOCK_SESSION = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  user: { id: "user-123" },
};

// ── Apple Sign In (iOS) ───────────────────────────────────────────────────────

describe("signInWithApple — iOS", () => {
  beforeEach(() => {
    (Platform as any).OS = "ios";
    jest.clearAllMocks();
  });

  it("happy path: returns session on successful sign-in", async () => {
    (AppleAuth.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: "apple-identity-token",
      user: "apple-user-id",
    });
    (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValueOnce({
      data: { session: MOCK_SESSION },
      error: null,
    });

    const session = await signInWithApple();

    expect(Crypto.randomUUID).toHaveBeenCalled();
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      "mock-uuid-1234",
    );
    expect(AppleAuth.signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        nonce: "mock-hashed-nonce-abcdef1234",
      }),
    );
    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-identity-token",
      nonce: "mock-uuid-1234",
    });
    expect(session).toEqual(MOCK_SESSION);
  });

  it("user cancel: returns null silently", async () => {
    const cancelError = new Error("Cancelled");
    (cancelError as any).code = "ERR_REQUEST_CANCELED";
    (AppleAuth.signInAsync as jest.Mock).mockRejectedValueOnce(cancelError);

    const session = await signInWithApple();

    expect(session).toBeNull();
    expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("no identityToken: throws descriptive error", async () => {
    (AppleAuth.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: null,
      user: "apple-user-id",
    });

    await expect(signInWithApple()).rejects.toThrow(
      "Apple Sign In не вернул токен",
    );
  });

  it("Supabase token exchange error: throws descriptive error", async () => {
    (AppleAuth.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: "apple-token",
      user: "apple-user-id",
    });
    (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValueOnce({
      data: { session: null },
      error: { message: "Invalid nonce" },
    });

    await expect(signInWithApple()).rejects.toThrow(
      "Не удалось войти через Apple",
    );
  });

  it("nonce is passed raw to Supabase and hashed to Apple", async () => {
    (AppleAuth.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: "apple-identity-token",
      user: "apple-user-id",
    });
    (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValueOnce({
      data: { session: MOCK_SESSION },
      error: null,
    });

    await signInWithApple();

    // Apple receives SHA-256 hash; Supabase receives raw nonce
    const appleCallArgs = (AppleAuth.signInAsync as jest.Mock).mock.calls[0][0];
    const supabaseCallArgs = (supabase.auth.signInWithIdToken as jest.Mock).mock
      .calls[0][0];

    expect(appleCallArgs.nonce).toBe("mock-hashed-nonce-abcdef1234"); // hashed
    expect(supabaseCallArgs.nonce).toBe("mock-uuid-1234"); // raw
    expect(appleCallArgs.nonce).not.toBe(supabaseCallArgs.nonce);
  });
});

// ── Google Sign In ────────────────────────────────────────────────────────────

describe("signInWithGoogle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = "ios";
  });

  it("happy path: returns session on successful sign-in", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      data: { idToken: "google-id-token" },
    });
    (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValueOnce({
      data: { session: MOCK_SESSION },
      error: null,
    });

    const session = await signInWithGoogle();

    // webClientId comes from jest.setup.js env var (test-web-client-id)
    expect(GoogleSignin.configure).toHaveBeenCalledWith(
      expect.objectContaining({ webClientId: "test-web-client-id" }),
    );
    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: "google",
      token: "google-id-token",
    });
    expect(session).toEqual(MOCK_SESSION);
  });

  it("user cancel: returns null silently", async () => {
    const cancelError = new Error("Cancelled");
    (cancelError as any).code = statusCodes.SIGN_IN_CANCELLED;
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce(cancelError);

    const session = await signInWithGoogle();

    expect(session).toBeNull();
    expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it("no idToken: throws descriptive error", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      data: { idToken: null },
    });

    await expect(signInWithGoogle()).rejects.toThrow(
      "Google Sign In не вернул токен",
    );
  });

  it("Google Play Services unavailable: throws descriptive error", async () => {
    (Platform as any).OS = "android";
    (GoogleSignin.hasPlayServices as jest.Mock).mockRejectedValueOnce(
      new Error("Play Services unavailable"),
    );

    await expect(signInWithGoogle()).rejects.toThrow(
      "Google Play Services недоступны",
    );
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
  });

  it("Supabase exchange error: throws descriptive error", async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({
      data: { idToken: "google-id-token" },
    });
    (supabase.auth.signInWithIdToken as jest.Mock).mockResolvedValueOnce({
      data: { session: null },
      error: { message: "provider disabled" },
    });

    await expect(signInWithGoogle()).rejects.toThrow(
      "Не удалось войти через Google",
    );
  });
});

// ── Sign Out ──────────────────────────────────────────────────────────────────

describe("signOut", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls Supabase signOut", async () => {
    (GoogleSignin.getCurrentUser as jest.Mock).mockReturnValueOnce(null);

    await signOut();

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it("calls GoogleSignin.signOut if signed in via Google", async () => {
    (GoogleSignin.getCurrentUser as jest.Mock).mockReturnValueOnce({
      id: "google-user-123",
    });

    await signOut();

    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it("swallows GoogleSignin errors and still calls Supabase signOut", async () => {
    (GoogleSignin.getCurrentUser as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Google error");
    });

    await expect(signOut()).resolves.toBeUndefined();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});
