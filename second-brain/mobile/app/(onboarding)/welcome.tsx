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
import { signInWithEmail, signUpWithEmail } from "../../services/api";
import {
  signInWithApple,
  signInWithGoogle,
  isGoogleSignInConfigured,
} from "../../services/auth";

type OAuthProvider = "apple" | "google" | null;

export default function Welcome() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider>(null);

  const googleConfigured = isGoogleSignInConfigured();

  async function handleAuth() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      Alert.alert("Нужно заполнить email и пароль");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const result = await signUpWithEmail(normalizedEmail, password);
        if (!result.session) {
          Alert.alert(
            "Почти готово",
            "Проверь почту и подтверди регистрацию, если Supabase требует email confirmation.",
          );
          return;
        }
        router.replace("/(onboarding)/setup");
      } else {
        await signInWithEmail(normalizedEmail, password);
        router.replace("/(onboarding)/setup");
      }
    } catch (e: any) {
      Alert.alert("Ошибка входа", e.message ?? "Не удалось войти");
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
        Alert.alert("Нет подключения", "Попробуй позже или войди по email.");
      } else {
        Alert.alert(
          "Ошибка входа",
          "Не удалось авторизоваться. Попробуй ещё раз или войди по email.",
        );
      }
    } finally {
      setOauthLoading(null);
    }
  }

  async function handleGoogleSignIn() {
    if (!googleConfigured) {
      Alert.alert("Google Sign In не настроен", "Обратитесь к разработчику.");
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
        Alert.alert("Нет подключения", "Попробуй позже или войди по email.");
      } else {
        Alert.alert(
          "Ошибка входа",
          "Не удалось авторизоваться. Попробуй ещё раз или войди по email.",
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
      <Text style={styles.title}>Привет, я твой{"\n"}Второй Мозг</Text>
      <Text style={styles.subtitle}>
        Скажи всё что у тебя в голове — я структурирую и напомню.
      </Text>

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
            <Text style={styles.appleButtonText}> Войти через Apple</Text>
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
              <Text style={styles.googleButtonText}>Войти через Google</Text>
            </>
          )}
        </Pressable>
      ) : null}

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>или по email</Text>
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
          <Text style={styles.toggleText}>Регистрация</Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleButton,
            mode === "signin" && styles.toggleActive,
          ]}
          onPress={() => setMode("signin")}
        >
          <Text style={styles.toggleText}>Вход</Text>
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
        placeholder="Пароль"
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
            {mode === "signup" ? "Создать аккаунт" : "Войти"}
          </Text>
        )}
      </Pressable>
      <Text style={styles.secondaryText}>
        Один аккаунт будет работать на iPhone, Android, Mac и Windows.
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
          <Text style={styles.appleButtonText}> Войти через Apple</Text>
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
