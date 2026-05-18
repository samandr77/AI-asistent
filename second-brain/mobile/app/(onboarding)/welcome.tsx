import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { signInWithEmail, signUpWithEmail } from "../../services/api";
import {
  signInWithApple,
  signInWithGoogle,
  isGoogleSignInConfigured,
} from "../../services/auth";

type OAuthProvider = "apple" | "google" | null;

export default function Welcome() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider>(null);

  const googleConfigured = isGoogleSignInConfigured();

  async function handleAuth() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      Alert.alert(t("onboarding.fill_credentials"));
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const result = await signUpWithEmail(normalizedEmail, password);
        if (!result.session) {
          Alert.alert(
            t("onboarding.almost_done"),
            t("onboarding.check_email_body"),
          );
          return;
        }
        router.replace("/(onboarding)/setup");
      } else {
        await signInWithEmail(normalizedEmail, password);
        router.replace("/(onboarding)/setup");
      }
    } catch (e: any) {
      Alert.alert(
        t("onboarding.sign_in_error_title"),
        e.message ?? t("onboarding.sign_in_error_body"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setOauthLoading("apple");
    try {
      const session = await signInWithApple();
      if (!session) return; // user cancelled
      router.replace("/(onboarding)/setup");
    } catch (e: any) {
      const message: string = e?.message ?? "";
      if (
        message.toLowerCase().includes("network") ||
        message.toLowerCase().includes("fetch")
      ) {
        Alert.alert(
          t("onboarding.no_connection_title"),
          t("onboarding.no_connection_body"),
        );
      } else {
        Alert.alert(
          t("onboarding.sign_in_failed_title"),
          t("onboarding.sign_in_failed_body"),
        );
      }
    } finally {
      setOauthLoading(null);
    }
  }

  async function handleGoogleSignIn() {
    if (!googleConfigured) {
      Alert.alert(
        t("onboarding.google_not_configured_title"),
        t("onboarding.google_not_configured_body"),
      );
      return;
    }
    setOauthLoading("google");
    try {
      const session = await signInWithGoogle();
      if (!session) return; // user cancelled
      router.replace("/(onboarding)/setup");
    } catch (e: any) {
      const message: string = e?.message ?? "";
      if (message.includes("Play Services")) {
        Alert.alert("Google Play Services", message);
      } else if (
        message.toLowerCase().includes("network") ||
        message.toLowerCase().includes("fetch")
      ) {
        Alert.alert(
          t("onboarding.no_connection_title"),
          t("onboarding.no_connection_body"),
        );
      } else {
        Alert.alert(
          t("onboarding.sign_in_failed_title"),
          t("onboarding.sign_in_failed_body"),
        );
      }
    } finally {
      setOauthLoading(null);
    }
  }

  const isAnyOAuthLoading = oauthLoading !== null;

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🧠</Text>
      <Text style={styles.title}>{t("onboarding.welcome_title")}</Text>
      <Text style={styles.subtitle}>{t("onboarding.welcome_subtitle")}</Text>

      {/* Apple Sign In — MUST appear above Google (App Store requirement) */}
      {Platform.OS === "ios" ? (
        <AppleButtonNative
          loading={oauthLoading === "apple"}
          disabled={isAnyOAuthLoading || loading}
          onPress={handleAppleSignIn}
        />
      ) : (
        <Pressable
          style={[
            styles.appleButton,
            (isAnyOAuthLoading || loading) && styles.buttonDisabled,
          ]}
          onPress={handleAppleSignIn}
          disabled={isAnyOAuthLoading || loading}
        >
          {oauthLoading === "apple" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.appleButtonText}>
              {t("onboarding.sign_in_apple")}
            </Text>
          )}
        </Pressable>
      )}

      {/* Google Sign In */}
      {googleConfigured ? (
        <Pressable
          style={[
            styles.googleButton,
            (isAnyOAuthLoading || loading) && styles.buttonDisabled,
          ]}
          onPress={handleGoogleSignIn}
          disabled={isAnyOAuthLoading || loading}
        >
          {oauthLoading === "google" ? (
            <ActivityIndicator color="#1a1a1a" />
          ) : (
            <>
              <GoogleLogo />
              <Text style={styles.googleButtonText}>
                {t("onboarding.sign_in_google")}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t("onboarding.or_email")}</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.toggle}>
        <Pressable
          style={[
            styles.toggleButton,
            mode === "signup" && styles.toggleActive,
          ]}
          onPress={() => setMode("signup")}
        >
          <Text style={styles.toggleText}>{t("onboarding.register")}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleButton,
            mode === "signin" && styles.toggleActive,
          ]}
          onPress={() => setMode("signin")}
        >
          <Text style={styles.toggleText}>{t("onboarding.sign_in")}</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#555"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={t("onboarding.password_placeholder")}
        placeholderTextColor="#555"
        secureTextEntry
      />
      <Pressable
        style={[
          styles.primary,
          (loading || isAnyOAuthLoading) && styles.buttonDisabled,
        ]}
        onPress={handleAuth}
        disabled={loading || isAnyOAuthLoading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>
            {mode === "signup"
              ? t("onboarding.create_account")
              : t("onboarding.do_sign_in")}
          </Text>
        )}
      </Pressable>
      <Text style={styles.secondaryText}>
        {t("onboarding.cross_platform_note")}
      </Text>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AppleButtonNative({
  loading,
  disabled,
  onPress,
}: {
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  // On iOS we use the native AppleAuthenticationButton for App Store compliance.
  // Lazy import to avoid errors on Android where the module isn't available.
  try {
    const AppleAuthentication = require("expo-apple-authentication");
    return (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={16}
        style={styles.appleNativeButton}
        onPress={disabled ? undefined : onPress}
      />
    );
  } catch {
    // Fallback if module not available (simulator without entitlement)
    return (
      <Pressable
        style={[styles.appleButton, disabled && styles.buttonDisabled]}
        onPress={onPress}
        disabled={disabled}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.appleButtonText}>
            {t("onboarding.sign_in_apple")}
          </Text>
        )}
      </Pressable>
    );
  }
}

function GoogleLogo() {
  return (
    <View style={styles.googleLogoContainer}>
      <Text style={styles.googleLogoText}>G</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emoji: { fontSize: 64, marginBottom: 24 },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 32,
    lineHeight: 24,
  },
  appleNativeButton: {
    width: "100%",
    height: 52,
    marginBottom: 12,
  },
  appleButton: {
    backgroundColor: "#000",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    height: 52,
    flexDirection: "row",
  },
  appleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  googleButton: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    height: 52,
    flexDirection: "row",
    gap: 8,
  },
  googleButtonText: {
    color: "#1a1a1a",
    fontSize: 16,
    fontWeight: "600",
  },
  googleLogoContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleLogoText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  buttonDisabled: { opacity: 0.5 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
    marginTop: 4,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2a2a2a",
  },
  dividerText: {
    color: "#555",
    fontSize: 13,
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: "#131313",
    borderRadius: 14,
    padding: 4,
    width: "100%",
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
  },
  toggleActive: {
    backgroundColor: "#1E1E1E",
  },
  toggleText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    width: "100%",
    backgroundColor: "#121212",
    color: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  primary: {
    backgroundColor: "#4F8EF7",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  secondaryText: {
    color: "#555",
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
  },
});
