import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../services/api";

export default function Welcome() {
  const router = useRouter();

  async function handleSignIn() {
    const email = "demo@secondbrain.app";
    await supabase.auth.signInWithOtp({ email });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🧠</Text>
      <Text style={styles.title}>Привет, я твой{"\n"}Второй Мозг</Text>
      <Text style={styles.subtitle}>
        Скажи всё что у тебя в голове — я структурирую и напомню.
      </Text>
      <Pressable
        style={styles.primary}
        onPress={() => router.push("/(onboarding)/setup")}
      >
        <Text style={styles.primaryText}>Начать →</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={handleSignIn}>
        <Text style={styles.secondaryText}>Уже есть аккаунт</Text>
      </Pressable>
    </View>
  );
}

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
    marginBottom: 48,
    lineHeight: 24,
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
  secondary: { marginTop: 16 },
  secondaryText: { color: "#555", fontSize: 15 },
});
