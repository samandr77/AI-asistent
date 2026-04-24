import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "../../../store/useAppStore";
import {
  getTodaySummary,
  createReflection,
  updateReflection,
  DailySummary,
} from "../../../services/api";
import {
  cancelEveningReflection,
  scheduleEveningReflection,
} from "../../../services/notifications";

const MOOD_EMOJI = ["😞", "😕", "😐", "🙂", "😄"];
const ENERGY_EMOJI = ["😴", "😒", "😌", "⚡", "🔥"];
const MAX_NOTES = 4000;

export default function ReflectionToday() {
  const router = useRouter();
  const { addReflection, reflectionReminderTime } = useAppStore();

  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loadingSum, setLoadingSum] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tzOffset = -new Date().getTimezoneOffset();

  useEffect(() => {
    loadSummary();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSummary() {
    setLoadingSum(true);
    setSummaryError(null);
    try {
      const data = await getTodaySummary(tzOffset);
      setSummary(data);
      if (data.existing_reflection) {
        setMood(data.existing_reflection.mood);
        setEnergy(data.existing_reflection.energy);
        setNotes(data.existing_reflection.notes ?? "");
      }
    } catch (e: any) {
      setSummaryError(e?.message ?? "Не удалось загрузить сводку");
    } finally {
      setLoadingSum(false);
    }
  }

  async function handleSubmit() {
    if (mood === null || energy === null) return;
    setSubmitting(true);
    try {
      const existing = summary?.existing_reflection;
      let saved;
      if (existing) {
        saved = await updateReflection(existing.id, {
          mood,
          energy,
          notes: notes || undefined,
        });
      } else {
        saved = await createReflection({
          mood,
          energy,
          notes: notes || undefined,
        });
      }
      addReflection(saved);

      // reschedule notification to tomorrow to avoid double-fire today
      if (reflectionReminderTime) {
        await cancelEveningReflection();
        await scheduleEveningReflection(reflectionReminderTime);
      }

      Alert.alert("Готово", "Рефлексия сохранена", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось сохранить рефлексию");
    } finally {
      setSubmitting(false);
    }
  }

  const isExisting = Boolean(summary?.existing_reflection);
  const canSubmit =
    mood !== null && energy !== null && notes.length <= MAX_NOTES;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </Pressable>
        <Text style={styles.title}>
          {isExisting ? "Обновить рефлексию" : "Вечерняя рефлексия"}
        </Text>
      </View>

      {loadingSum ? (
        <ActivityIndicator color="#4F8EF7" style={{ marginTop: 32 }} />
      ) : summaryError ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>{summaryError}</Text>
          <Pressable onPress={loadSummary} style={styles.retryBtn}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      ) : summary ? (
        <View style={styles.summaryBlock}>
          <Text style={styles.sectionLabel}>Итоги дня</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>
                {summary.completed_tasks.length}
              </Text>
              <Text style={styles.statLabel}>задач выполнено</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>
                {summary.goal_aligned_tasks.length}
              </Text>
              <Text style={styles.statLabel}>к целям</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>
                {summary.goals_with_progress.length}
              </Text>
              <Text style={styles.statLabel}>целей с прогрессом</Text>
            </View>
          </View>
          {summary.goals_with_progress.length > 0 && (
            <View style={styles.goalsBlock}>
              {summary.goals_with_progress.map((g) => (
                <View key={g.id} style={styles.goalBadge}>
                  <Text style={styles.goalBadgeText}>
                    🎯 {g.title} (+{g.completed_task_count})
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Настроение</Text>
      <View style={styles.emojiRow}>
        {MOOD_EMOJI.map((emoji, i) => (
          <Pressable
            key={i}
            style={[styles.emojiBtn, mood === i + 1 && styles.emojiBtnActive]}
            onPress={() => setMood(i + 1)}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
            <Text style={styles.emojiNum}>{i + 1}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Энергия</Text>
      <View style={styles.emojiRow}>
        {ENERGY_EMOJI.map((emoji, i) => (
          <Pressable
            key={i}
            style={[styles.emojiBtn, energy === i + 1 && styles.emojiBtnActive]}
            onPress={() => setEnergy(i + 1)}
          >
            <Text style={styles.emojiText}>{emoji}</Text>
            <Text style={styles.emojiNum}>{i + 1}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>
        Заметки{" "}
        <Text
          style={notes.length > MAX_NOTES ? styles.counterRed : styles.counter}
        >
          {notes.length}/{MAX_NOTES}
        </Text>
      </Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="Что было важным сегодня?"
        placeholderTextColor="#555"
        multiline
        maxLength={MAX_NOTES + 1}
      />
      {notes.length > MAX_NOTES && (
        <Text style={styles.errorText}>Максимум {MAX_NOTES} символов</Text>
      )}

      {(mood === null || energy === null) && (
        <Text style={styles.hintText}>
          Выбери настроение и энергию чтобы сохранить
        </Text>
      )}

      <Pressable
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit || submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            {isExisting ? "Обновить" : "Сохранить"}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  content: { padding: 16, paddingTop: 56, paddingBottom: 48 },
  header: { marginBottom: 24 },
  back: { color: "#4F8EF7", fontSize: 15, marginBottom: 12 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  summaryBlock: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 10,
  },
  statNum: { color: "#4F8EF7", fontSize: 22, fontWeight: "700" },
  statLabel: { color: "#888", fontSize: 11, textAlign: "center", marginTop: 2 },
  goalsBlock: { gap: 6 },
  goalBadge: {
    backgroundColor: "#1E293B",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  goalBadgeText: { color: "#93C5FD", fontSize: 13 },
  emojiRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  emojiBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  emojiBtnActive: { borderColor: "#4F8EF7", backgroundColor: "#1E2A3A" },
  emojiText: { fontSize: 22 },
  emojiNum: { color: "#888", fontSize: 11, marginTop: 2 },
  notesInput: {
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 4,
  },
  counter: { color: "#555", fontWeight: "400", textTransform: "none" },
  counterRed: { color: "#ef4444", fontWeight: "400", textTransform: "none" },
  hintText: {
    color: "#555",
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
    textAlign: "center",
  },
  errorBlock: { alignItems: "center", marginBottom: 16 },
  errorText: { color: "#ef4444", fontSize: 14, marginBottom: 8 },
  retryBtn: {
    borderWidth: 1,
    borderColor: "#4F8EF7",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: "#4F8EF7", fontSize: 14 },
  submitBtn: {
    backgroundColor: "#4F8EF7",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
