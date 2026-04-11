import { useEffect } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useAppStore } from "../../store/useAppStore";
import { getTodayTasks } from "../../services/api";
import TaskCard from "../../components/TaskCard";
import DumpButton from "../../components/DumpButton";
import { useRouter } from "expo-router";

export default function Home() {
  const { todayTasks, user, setTodayTasks, isLoading, setLoading } =
    useAppStore();
  const router = useRouter();

  async function refresh() {
    setLoading(true);
    const tasks = await getTodayTasks();
    setTodayTasks(tasks);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const greeting = user?.name ? `Привет, ${user.name} 👋` : "Привет! 👋";
  const today = new Date().toLocaleDateString("ru", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.date}>{today}</Text>
      </View>

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
  header: { paddingTop: 48, marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#fff" },
  date: { color: "#888", fontSize: 14, marginTop: 4 },
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
