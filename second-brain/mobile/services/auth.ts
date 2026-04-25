import { Platform } from "react-native";
import { Session } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { supabase } from "./api";
import { i18n } from "./i18n";

const tr = (key: string, opts?: Record<string, unknown>) =>
  i18n.isInitialized ? i18n.t(key, opts) : key;

// ── Apple Sign In ─────────────────────────────────────────────────────────────

async function _appleSignInIOS(): Promise<Session | null> {
  // Raw nonce for Supabase; SHA-256 hex for Apple (prevents replay attacks)
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let credential: Awaited<ReturnType<typeof AppleAuthentication.signInAsync>>;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e: any) {
    if (e?.code === "ERR_REQUEST_CANCELED") {
      return null; // user dismissed — swallow silently
    }
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error(tr("auth.apple_no_token"));
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error) {
    throw new Error(tr("auth.apple_failed", { error: error.message }));
  }

  return data.session;
}

async function _appleSignInAndroid(): Promise<Session | null> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(tr("auth.supabase_url_missing"));
  }

  const redirectUrl = "secondbrain://auth/callback";
  const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=apple&redirect_to=${encodeURIComponent(redirectUrl)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

  if (result.type === "cancel" || result.type === "dismiss") {
    return null;
  }

  if (result.type !== "success") {
    throw new Error(tr("auth.apple_generic_error"));
  }

  // Supabase JS client handles session from the callback URL automatically
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error(tr("auth.apple_generic_error"));
  }

  return session;
}

export async function signInWithApple(): Promise<Session | null> {
  const t0 = performance.now();
  try {
    const session =
      Platform.OS === "ios"
        ? await _appleSignInIOS()
        : await _appleSignInAndroid();
    if (__DEV__) {
      console.log(
        `[auth] Apple sign-in completed in ${(performance.now() - t0).toFixed(0)}ms`,
      );
    }
    return session;
  } catch (e: any) {
    if (__DEV__) {
      console.warn("[auth] Apple sign-in error:", e?.message ?? e);
    }
    throw e;
  }
}

// ── Google Sign In ────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<Session | null> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  if (!webClientId) {
    throw new Error(tr("auth.google_not_configured"));
  }

  GoogleSignin.configure({
    webClientId,
    ...(Platform.OS === "ios" && iosClientId ? { iosClientId } : {}),
  });

  if (Platform.OS === "android") {
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    } catch {
      throw new Error(tr("auth.google_play_unavailable"));
    }
  }

  const t0 = performance.now();

  let userInfo: Awaited<ReturnType<typeof GoogleSignin.signIn>>;
  try {
    userInfo = await GoogleSignin.signIn();
  } catch (e: any) {
    if (e?.code === statusCodes.SIGN_IN_CANCELLED) {
      return null; // user dismissed — swallow silently
    }
    if (e?.code === statusCodes.IN_PROGRESS) {
      return null; // already in progress
    }
    if (__DEV__) {
      console.warn("[auth] Google sign-in error:", e?.message ?? e);
    }
    throw new Error(tr("auth.google_generic_error"));
  }

  const idToken = userInfo.data?.idToken;
  if (!idToken) {
    throw new Error(tr("auth.google_no_token"));
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });

  if (error) {
    throw new Error(tr("auth.google_failed", { error: error.message }));
  }

  if (__DEV__) {
    console.log(
      `[auth] Google sign-in completed in ${(performance.now() - t0).toFixed(0)}ms`,
    );
  }

  return data.session;
}

// ── Sign Out ──────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  // Best-effort Google sign-out — do not block Supabase sign-out on failure
  try {
    // v14+: getCurrentUser() replaces isSignedIn()
    const currentUser = GoogleSignin.getCurrentUser();
    if (currentUser != null) {
      await GoogleSignin.signOut();
    }
  } catch {
    // swallow — user may not have signed in via Google
  }

  await supabase.auth.signOut();
}

// ── Availability helpers ──────────────────────────────────────────────────────

export function isAppleSignInConfigured(): boolean {
  // Apple Sign In does not require a mobile env var — always available on supported platforms
  return true;
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
}
