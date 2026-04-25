import { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
} from "react-native";
import { useAppStore } from "../../store/useAppStore";
import { getTodayTasks } from "../../services/api";
import TaskCard from "../../components/TaskCard";
import DumpButton from "../../components/DumpButton";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

export default function Home() {
  const { t, i18n } = useTranslation();
  const {
    todayTasks,
    user,
    setTodayTasks,
    isLoading,
    setLoading,
    reflections,
    reflectionStats,
  } = useAppStore();
  const router = useRouter();

  const hour = new Date().getHours();
  const showReflectionCard = hour >= 18;
  const todayDate = new Date().toISOString().slice(0, 10);
  const todayReflection = reflections.find((r) => r.date === todayDate);
  const currentStreak = reflectionStats?.current_streak ?? 0;

  async function refresh() {
    setLoading(true);
    try {
      const tasks = await getTodayTasks();
      setTodayTasks(tasks);
    } catch {
      /* silent — don't interrupt UX */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const greeting = user?.name
    ? t("home.greeting_with_name", { name: user.name })
    : t("home.greeting");
  const localeTag = i18n.language === "ru" ? "ru" : "en";
  const todayLabel = new Date().toLocaleDateString(localeTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.date}>{todayLabel}</Text>
      </View>

      {showReflectionCard &&
        (todayReflection ? (
          <Pressable
            style={styles.streakCard}
            onPress={() => router.push("/(app)/reflection/today")}
          >
            <Text style={styles.streakCardText}>
              {currentStreak > 0
                ? t("home.streak_done", { count: currentStreak })
                : t("home.reflection_done")}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.reflectionCard}
            onPress={() => router.push("/(app)/reflection/today")}
          >
            <Text style={styles.reflectionCardText}>
              {t("home.reflection_finish_day")}
            </Text>
            <Text style={styles.reflectionCardHint}>
              {t("home.reflection_question")}
            </Text>
          </Pressable>
        ))}

      <Text style={styles.section}>{t("home.section_today")}</Text>

      {todayTasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("home.empty_today")}</Text>
          <Text style={styles.emptyHint}>{t("home.empty_today_hint")}</Text>
        </View>
      ) : (
        <FlatList
          data={todayTasks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onPress={() => router.push(`/(app)/task/${item.id}`)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} />
          }
        />
      )}
      <DumpButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A", padding: 16 },
  header: { paddingTop: 48, marginBottom: 16 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#fff" },
  date: { color: "#888", fontSize: 14, marginTop: 4 },
  reflectionCard: {
    backgroundColor: "#1A2A1A",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#4ade80",
  },
  reflectionCardText: { color: "#4ade80", fontSize: 15, fontWeight: "600" },
  reflectionCardHint: { color: "#888", fontSize: 12, marginTop: 4 },
  streakCard: {
    backgroundColor: "#2A1A0A",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  streakCardText: { color: "#f59e0b", fontSize: 15, fontWeight: "600" },
  section: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { color: "#555", fontSize: 16 },
  emptyHint: { color: "#333", fontSize: 14 },
});
