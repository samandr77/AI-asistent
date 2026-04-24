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

export default function Home() {
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

  const greeting = user?.name ? `Привет, ${user.name} 👋` : "Привет! 👋";
  const todayLabel = new Date().toLocaleDateString("ru", {
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
                ? `${currentStreak} дн. подряд — отличная работа!`
                : "Рефлексия выполнена"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.reflectionCard}
            onPress={() => router.push("/(app)/reflection/today")}
          >
            <Text style={styles.reflectionCardText}>
              Завершить день рефлексией
            </Text>
            <Text style={styles.reflectionCardHint}>
              Как прошёл день? Двигался ли ты к целям?
            </Text>
          </Pressable>
        ))}

      <Text style={styles.section}>На сегодня</Text>

      {todayTasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Нет задач на сегодня</Text>
          <Text style={styles.emptyHint}>Нажми 🎤 чтобы добавить</Text>
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
