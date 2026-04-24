import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "../../store/useAppStore";
import { getAllTasks } from "../../services/api";
import { SPHERES, Sphere } from "../../constants/spheres";
import TaskCard from "../../components/TaskCard";
import SphereTab from "../../components/SphereTab";

const FREE_HISTORY_DAYS = 30;

export default function All() {
  const { allTasks, setAllTasks, isLoading, setLoading, premium } =
    useAppStore();
  const router = useRouter();
  const [sphere, setSphere] = useState<Sphere | "all">("all");

  async function refresh() {
    setLoading(true);
    try {
      const tasks = await getAllTasks();
      setAllTasks(tasks);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cutoffDate = premium.is_premium
    ? null
    : new Date(Date.now() - FREE_HISTORY_DAYS * 24 * 60 * 60 * 1000);

  const visibleTasks = cutoffDate
    ? allTasks.filter((t) => !t.deadline || new Date(t.deadline) >= cutoffDate)
    : allTasks;

  const displayed =
    sphere === "all"
      ? visibleTasks
      : visibleTasks.filter((t) => t.sphere === sphere);

  const hiddenCount = allTasks.length - visibleTasks.length;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
      >
        <SphereTab
          sphere="all"
          count={allTasks.length}
          isActive={sphere === "all"}
          onPress={() => setSphere("all")}
        />
        {SPHERES.map((s) => (
          <SphereTab
            key={s.id}
            sphere={s.id}
            count={allTasks.filter((t) => t.sphere === s.id).length}
            isActive={sphere === s.id}
            onPress={() => setSphere(s.id)}
          />
        ))}
      </ScrollView>
      {hiddenCount > 0 && (
        <Pressable
          style={styles.cutoffBanner}
          onPress={() => router.push("/(app)/paywall")}
        >
          <Text style={styles.cutoffText}>
            {hiddenCount} задач скрыто — история ограничена {FREE_HISTORY_DAYS}{" "}
            днями
          </Text>
          <Text style={styles.cutoffCta}>Открыть Premium</Text>
        </Pressable>
      )}
      <FlatList
        data={displayed}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 16,
    paddingTop: 48,
  },
  tabs: { marginBottom: 16, flexGrow: 0 },
  cutoffBanner: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#9B59B620",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cutoffText: { color: "#888", fontSize: 13, flex: 1 },
  cutoffCta: { color: "#9B59B6", fontSize: 13, fontWeight: "600" },
});
