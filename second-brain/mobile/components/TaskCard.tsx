import { useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Task, useAppStore } from "../store/useAppStore";
import { SPHERE_MAP } from "../constants/spheres";
import { updateTask } from "../services/api";

interface Props {
  task: Task;
  onPress?: () => void;
}

const PRIORITY_COLOR: Record<number, string> = {
  1: "#6b7280",
  2: "#f59e0b",
  3: "#ef4444",
};

export default function TaskCard({ task, onPress }: Props) {
  const { updateTask: updateStore } = useAppStore();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? "ru" : "en";
  const sphere = SPHERE_MAP[task.sphere];
  const isPending = useRef(false);

  async function handleDone() {
    if (isPending.current) return;
    isPending.current = true;
    try {
      await updateTask(task.id, { is_done: true });
      updateStore(task.id, { is_done: true });
    } finally {
      isPending.current = false;
    }
  }

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View
        style={[styles.sphereBar, { backgroundColor: sphere?.color ?? "#999" }]}
      />
      <View style={styles.content}>
        <Text style={styles.title}>{task.title}</Text>
        <View style={styles.meta}>
          <Text style={styles.sphere}>
            {sphere?.icon} {sphere ? t(sphere.labelKey) : ""}
          </Text>
          {task.goal_id && <Text style={styles.goalBadge}>🎯</Text>}
          {task.deadline && (
            <Text style={styles.deadline}>
              📅 {new Date(task.deadline).toLocaleDateString(locale)}
            </Text>
          )}
        </View>
      </View>
      <Pressable
        onPress={handleDone}
        style={styles.doneBtn}
        onStartShouldSetResponder={() => true}
      >
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <Text style={{ color: PRIORITY_COLOR[task.priority] }}>✓</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  sphereBar: { width: 4 },
  content: { flex: 1, padding: 12 },
  title: { color: "#fff", fontSize: 15, fontWeight: "500" },
  meta: { flexDirection: "row", gap: 12, marginTop: 4 },
  sphere: { color: "#888", fontSize: 12 },
  goalBadge: { fontSize: 12 },
  deadline: { color: "#888", fontSize: 12 },
  doneBtn: { justifyContent: "center", paddingHorizontal: 16 },
});
