import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppStore, Goal, Task } from "../../../store/useAppStore";
import {
  getGoal,
  updateGoal,
  deleteGoal,
  getGoalTasks,
  getGoalProgress,
  GoalProgressResponse,
} from "../../../services/api";

const STATUS_OPTIONS = [
  { key: "active", labelKey: "goals.status_active" },
  { key: "paused", labelKey: "goals.status_paused" },
  { key: "achieved", labelKey: "goals.status_achieved" },
  { key: "archived", labelKey: "goals.status_archived" },
] as const;

function ProgressBar({ percent }: { percent: number }) {
  return (
    <View style={styles.progressBg}>
      <View
        style={[styles.progressFill, { width: `${Math.min(percent, 100)}%` }]}
      />
    </View>
  );
}

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { updateGoal: updateStore, removeGoal } = useAppStore();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? "ru" : "en";

  const [goal, setGoal] = useState<Goal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<GoalProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [g, taskList, p] = await Promise.all([
        getGoal(id),
        getGoalTasks(id),
        getGoalProgress(id),
      ]);
      setGoal(g);
      setTasks(taskList);
      setProgress(p);
      setTitleDraft(g.title);
    } catch (e: any) {
      setError(e?.message ?? t("goals.load_detail_error"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveTitle() {
    if (!goal || !titleDraft.trim()) return;
    setSaving(true);
    try {
      const updated = await updateGoal(goal.id, { title: titleDraft.trim() });
      setGoal(updated);
      updateStore(goal.id, { title: updated.title });
    } catch (e: any) {
      Alert.alert(t("common.error_title"), e?.message ?? t("goals.save_error"));
    } finally {
      setSaving(false);
      setEditingTitle(false);
    }
  }

  async function changeStatus(status: Goal["status"]) {
    if (!goal) return;
    setSaving(true);
    try {
      const updated = await updateGoal(goal.id, { status });
      setGoal(updated);
      updateStore(goal.id, { status: updated.status });
    } catch (e: any) {
      Alert.alert(
        t("common.error_title"),
        e?.message ?? t("goals.status_change_error"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!goal) return;
    Alert.alert(t("goals.delete_title"), t("goals.delete_body"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("goals.delete_action"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteGoal(goal.id);
            removeGoal(goal.id);
            router.back();
          } catch (e: any) {
            Alert.alert(
              t("common.error_title"),
              e?.message ?? t("goals.delete_error"),
            );
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4F8EF7" />
      </View>
    );
  }

  if (error || !goal) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? t("goals.not_found")}</Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 8 }}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>
      </View>
    );
  }

  const displayProgress = progress?.computed_progress ?? goal.progress_percent;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title */}
      {editingTitle ? (
        <View style={styles.titleRow}>
          <TextInput
            style={styles.titleInput}
            value={titleDraft}
            onChangeText={setTitleDraft}
            autoFocus
            maxLength={200}
          />
          <Pressable
            onPress={saveTitle}
            disabled={saving}
            style={styles.saveBtn}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>OK</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setEditingTitle(true)}>
          <Text style={styles.title}>{goal.title}</Text>
          <Text style={styles.editHint}>{t("goals.edit_hint")}</Text>
        </Pressable>
      )}

      {goal.target_date && (
        <Text style={styles.meta}>
          {t("goals.deadline_label", {
            date: new Date(goal.target_date).toLocaleDateString(locale),
          })}
        </Text>
      )}

      {/* Progress */}
      <Text style={styles.sectionLabel}>{t("goals.section_progress")}</Text>
      <ProgressBar percent={displayProgress} />
      <Text style={styles.progressText}>{displayProgress}%</Text>
      {progress && (
        <Text style={styles.meta}>
          {t("goals.tasks_completed_summary", {
            done: progress.completed_tasks_count,
            total: progress.linked_tasks_count,
          })}
        </Text>
      )}

      {/* Status */}
      <Text style={styles.sectionLabel}>{t("goals.section_status")}</Text>
      <View style={styles.pillRow}>
        {STATUS_OPTIONS.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.pill, goal.status === s.key && styles.pillActive]}
            onPress={() => changeStatus(s.key)}
            disabled={saving}
          >
            <Text
              style={[
                styles.pillText,
                goal.status === s.key && styles.pillTextActive,
              ]}
            >
              {t(s.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Linked tasks */}
      <Text style={styles.sectionLabel}>{t("goals.section_linked_tasks")}</Text>
      {tasks.length === 0 ? (
        <Text style={styles.emptyText}>{t("goals.no_linked_tasks")}</Text>
      ) : (
        tasks.map((task) => (
          <View key={task.id} style={styles.taskRow}>
            <View
              style={[
                styles.taskDot,
                { backgroundColor: task.is_done ? "#2ECC71" : "#555" },
              ]}
            />
            <Text style={[styles.taskTitle, task.is_done && styles.taskDone]}>
              {task.title}
            </Text>
          </View>
        ))
      )}

      {/* Delete */}
      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteText}>{t("goals.delete_button")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  content: { padding: 24, paddingTop: 64, paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0A0A",
    gap: 12,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 2 },
  editHint: { color: "#444", fontSize: 11, marginBottom: 8 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  titleInput: {
    flex: 1,
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    padding: 10,
  },
  saveBtn: {
    backgroundColor: "#4F8EF7",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 44,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700" },
  meta: { color: "#888", fontSize: 13, marginBottom: 8 },
  sectionLabel: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  progressBg: {
    height: 6,
    backgroundColor: "#2A2A2A",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: { height: "100%", backgroundColor: "#4F8EF7", borderRadius: 3 },
  progressText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  pillActive: { backgroundColor: "#4F8EF7", borderColor: "#4F8EF7" },
  pillText: { color: "#888", fontSize: 13 },
  pillTextActive: { color: "#fff" },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  taskDot: { width: 8, height: 8, borderRadius: 4 },
  taskTitle: { color: "#fff", fontSize: 14, flex: 1 },
  taskDone: { color: "#555", textDecorationLine: "line-through" },
  emptyText: { color: "#555", fontSize: 14 },
  deleteBtn: { marginTop: 40, alignItems: "center", paddingVertical: 14 },
  deleteText: { color: "#ef4444", fontSize: 15 },
  errorText: { color: "#ef4444", fontSize: 15 },
  retryBtn: {
    borderWidth: 1,
    borderColor: "#4F8EF7",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: "#4F8EF7", fontSize: 14 },
  backText: { color: "#888", fontSize: 14 },
});
