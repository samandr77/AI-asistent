import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useAppStore } from "../../store/useAppStore";
import { supabase, api } from "../../services/api";
import {
  isPremium,
  buyPremium,
  restorePurchases,
  initRevenueCat,
} from "../../services/purchases";
import {
  requestPushPermission,
  scheduleEveningReminder,
} from "../../services/notifications";

export default function Profile() {
  const { user, allTasks, setUser, setTodayTasks, setAllTasks, setOnboarded } =
    useAppStore();
  const [hasPremium, setHasPremium] = useState(false);
  const [memories, setMemories] = useState<any[]>([]);

  useEffect(() => {
    initRevenueCat(user?.id);
    isPremium().then(setHasPremium);
    loadMemories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMemories() {
    try {
      const { data } = await api.get("/memory/profile");
      setMemories(data.slice(0, 5));
    } catch {}
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setTodayTasks([]);
    setAllTasks([]);
    setOnboarded(false);
  }

  async function handleBuyPremium() {
    const ok = await buyPremium();
    if (ok) setHasPremium(true);
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

      {!hasPremium && (
        <Pressable style={styles.premium} onPress={handleBuyPremium}>
          <Text style={styles.premiumText}>
            ⭐ Получить Премиум — $4.99/мес
          </Text>
        </Pressable>
      )}
      {hasPremium && <Text style={styles.premiumBadge}>⭐ Premium</Text>}

      <Pressable
        style={styles.row}
        onPress={async () => {
          const ok = await requestPushPermission();
          if (ok && user?.name) await scheduleEveningReminder(user.name);
          Alert.alert(ok ? "Уведомления включены ✓" : "Нет разрешения");
        }}
      >
        <Text style={styles.rowText}>🔔 Ежедневные напоминания</Text>
      </Pressable>

      <Pressable
        style={styles.row}
        onPress={() =>
          restorePurchases().then((ok) => ok && setHasPremium(true))
        }
      >
        <Text style={styles.rowText}>↩️ Восстановить покупки</Text>
      </Pressable>

      <Pressable style={[styles.row, styles.signOut]} onPress={handleSignOut}>
        <Text style={[styles.rowText, { color: "#ef4444" }]}>Выйти</Text>
      </Pressable>
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
  name: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 24 },
  stats: { flexDirection: "row", gap: 32, marginBottom: 32 },
  statItem: { alignItems: "center" },
  statNum: { color: "#fff", fontSize: 24, fontWeight: "700" },
  statLabel: { color: "#888", fontSize: 12 },
  premium: {
    backgroundColor: "#9B59B6",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
  },
  premiumText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  premiumBadge: { color: "#f59e0b", fontSize: 16, marginBottom: 24 },
  row: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 8,
  },
  rowText: { color: "#fff", fontSize: 15 },
  signOut: { marginTop: 8 },
});
