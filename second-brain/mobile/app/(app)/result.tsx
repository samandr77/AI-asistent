import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Task } from "../../store/useAppStore";
import { Sphere } from "../../constants/spheres";
import TaskCard from "../../components/TaskCard";
import SphereTab from "../../components/SphereTab";

export default function Result() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const router = useRouter();
  const parsed = data
    ? JSON.parse(data)
    : { tasks: [], today_top3: [], transcription: null };
  const tasks: Task[] = parsed.tasks ?? [];

  const [selectedSphere, setSelectedSphere] = useState<Sphere | "all">("all");

  const spheresPresent = Array.from(
    new Set(tasks.map((t) => t.sphere)),
  ) as Sphere[];
  const displayed =
    selectedSphere === "all"
      ? tasks
      : tasks.filter((t) => t.sphere === selectedSphere);

  return (
    <View style={styles.container}>
      {parsed.transcription && (
        <View style={styles.transcript}>
          <Text style={styles.transcriptLabel}>Транскрипция</Text>
          <Text style={styles.transcriptText} numberOfLines={3}>
            {parsed.transcription}
          </Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
      >
        <SphereTab
          sphere="all"
          count={tasks.length}
          isActive={selectedSphere === "all"}
          onPress={() => setSelectedSphere("all")}
        />
        {spheresPresent.map((s) => (
          <SphereTab
            key={s}
            sphere={s}
            count={tasks.filter((t) => t.sphere === s).length}
            isActive={selectedSphere === s}
            onPress={() => setSelectedSphere(s)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={displayed}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TaskCard task={item} />}
        style={styles.list}
      />

      <Pressable style={styles.done} onPress={() => router.replace("/(app)/")}>
        <Text style={styles.doneText}>Готово ✓</Text>
      </Pressable>
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
  transcript: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  transcriptLabel: { color: "#555", fontSize: 11, marginBottom: 4 },
  transcriptText: { color: "#888", fontSize: 13 },
  tabs: { marginBottom: 16, flexGrow: 0 },
  list: { flex: 1 },
  done: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  doneText: { color: "#4F8EF7", fontSize: 16, fontWeight: "600" },
});
