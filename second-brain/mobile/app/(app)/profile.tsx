import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "../../store/useAppStore";
import { api, supabase } from "../../services/api";
import { signOut as authSignOut } from "../../services/auth";
import {
  buyPremium,
  restorePurchases,
  getPremiumStatus,
} from "../../services/purchases";
import {
  requestPushPermission,
  scheduleEveningReminder,
} from "../../services/notifications";

export default function Profile() {
  const router = useRouter();
  const {
    user,
    allTasks,
    setUser,
    setTodayTasks,
    setAllTasks,
    setOnboarded,
    reflectionStats,
    premium,
    setPremium,
  } = useAppStore();
  const hasPremium = premium.is_premium;
  const [memories, setMemories] = useState<any[]>([]);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    getPremiumStatus()
      .then(setPremium)
      .catch(() => {});
    loadMemories();
    loadProvider();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProvider() {
    try {
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser();
      const p = (sbUser?.app_metadata as Record<string, unknown> | undefined)
        ?.provider;
      setProvider(typeof p === "string" ? p : null);
    } catch {
      // non-critical
    }
  }

  async function loadMemories() {
    try {
      const { data } = await api.get("/memory/profile");
      setMemories(data.slice(0, 5));
    } catch (e) {
      if (__DEV__) console.warn("loadMemories failed:", e);
    }
  }

  async function handleSignOut() {
    try {
      await authSignOut();
    } catch {
      /* ignore */
    }
    setUser(null);
    setTodayTasks([]);
    setAllTasks([]);
    setOnboarded(false);
  }

  async function handleBuyPremium() {
    const ok = await buyPremium();
    if (ok) {
      const status = await getPremiumStatus();
      setPremium(status);
    }
  }

  async function handleRestorePurchases() {
    const ok = await restorePurchases();
    if (ok) {
      const status = await getPremiumStatus();
      setPremium(status);
    }
  }

  const doneCount = allTasks.filter((t) => t.is_done).length;
  const totalCount = allTasks.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </Text>
      </View>
      <Text style={styles.name}>{user?.name ?? "Пользователь"}</Text>

      {provider != null && (
        <View style={styles.providerBadge}>
          <Text style={styles.providerBadgeText}>
            {provider === "apple"
              ? "Вошёл через Apple"
              : provider === "google"
                ? "Вошёл через Google"
                : `Вошёл через ${provider}`}
          </Text>
        </View>
      )}

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{totalCount}</Text>
          <Text style={styles.statLabel}>задач</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{doneCount}</Text>
          <Text style={styles.statLabel}>выполнено</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>
            {totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%
          </Text>
          <Text style={styles.statLabel}>прогресс</Text>
        </View>
      </View>

      {hasPremium ? (
        <View style={styles.premiumBadgeRow}>
          <Text style={styles.premiumBadge}>Premium активен</Text>
          {premium.expires_at && (
            <Text style={styles.premiumExpiry}>
              до{" "}
              {new Date(premium.expires_at).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
          )}
        </View>
      ) : (
        <Pressable style={styles.premium} onPress={handleBuyPremium}>
          <Text style={styles.premiumText}>Получить Премиум — $4.99/мес</Text>
        </Pressable>
      )}

      <Pressable
        style={styles.row}
        onPress={async () => {
          const ok = await requestPushPermission();
          if (ok && user?.name) await scheduleEveningReminder(user.name);
          Alert.alert(ok ? "Уведомления включены ✓" : "Нет разрешения");
        }}
      >
        <Text style={styles.rowText}>Ежедневные напоминания</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={handleRestorePurchases}>
        <Text style={styles.rowText}>Восстановить покупки</Text>
      </Pressable>

      <Pressable
        style={styles.row}
        onPress={() => router.push("/(app)/reflection/settings")}
      >
        <View style={styles.rowInner}>
          <Text style={styles.rowText}>Рефлексия</Text>
          {(reflectionStats?.current_streak ?? 0) > 0 && (
            <Text style={styles.streakBadge}>
              {reflectionStats!.current_streak} дн. подряд
            </Text>
          )}
        </View>
      </Pressable>

      <Pressable style={[styles.row, styles.signOut]} onPress={handleSignOut}>
        <Text style={[styles.rowText, { color: "#ef4444" }]}>Выйти</Text>
      </Pressable>

      {memories.length > 0 && (
        <View style={styles.memoriesSection}>
          <Text style={styles.memoriesTitle}>Контекст AI</Text>
          {memories.map((m, i) => (
            <Text key={i} style={styles.memoryItem}>
              {m.content}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  content: { padding: 24, paddingTop: 64, alignItems: "center" },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4F8EF7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  name: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 8 },
  providerBadge: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  providerBadgeText: { color: "#888", fontSize: 13 },
  stats: { flexDirection: "row", gap: 32, marginBottom: 32 },
  statItem: { alignItems: "center" },
  statNum: { color: "#fff", fontSize: 24, fontWeight: "700" },
  statLabel: { color: "#888", fontSize: 12 },
  premiumBadgeRow: { alignItems: "center", marginBottom: 24, gap: 4 },
  premiumBadge: { color: "#f59e0b", fontSize: 16, fontWeight: "600" },
  premiumExpiry: { color: "#888", fontSize: 12 },
  premium: {
    backgroundColor: "#9B59B6",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
  },
  premiumText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  row: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 8,
  },
  rowText: { color: "#fff", fontSize: 15 },
  rowInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streakBadge: { color: "#f59e0b", fontSize: 13, fontWeight: "600" },
  signOut: { marginTop: 8 },
  memoriesSection: { width: "100%", marginTop: 24 },
  memoriesTitle: {
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  memoryItem: {
    color: "#555",
    fontSize: 13,
    marginBottom: 4,
  },
});
