import { useState, useEffect } from "react";
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "../../store/useAppStore";
import { getAllTasks } from "../../services/api";
import { SPHERES, Sphere } from "../../constants/spheres";
import TaskCard from "../../components/TaskCard";
import SphereTab from "../../components/SphereTab";

export default function All() {
  const { allTasks, setAllTasks, isLoading, setLoading } = useAppStore();
  const router = useRouter();
  const [sphere, setSphere] = useState<Sphere | "all">("all");

  async function refresh() {
    setLoading(true);
    const tasks = await getAllTasks(sphere === "all" ? undefined : sphere);
    setAllTasks(tasks);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [sphere]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayed =
    sphere === "all" ? allTasks : allTasks.filter((t) => t.sphere === sphere);

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
});
