import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../../store/useAppStore";
import { getReflectionByDate, deleteReflection } from "../../../services/api";
import { Reflection } from "../../../store/useAppStore";

const MOOD_EMOJI = ["", "😞", "😕", "😐", "🙂", "😄"];
const ENERGY_EMOJI = ["", "😴", "😒", "😌", "⚡", "🔥"];

export default function ReflectionDetail() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? "ru" : "en";
  const { reflections, updateReflectionInStore } = useAppStore();
  const moodLabel = (m: number) => t(`reflection.mood_${m}`);
  const energyLabel = (e: number) => t(`reflection.energy_${e}`);

  const [reflection, setReflection] = useState<Reflection | null>(
    reflections.find((r) => r.date === date) ?? null,
  );
  const [loading, setLoading] = useState(!reflection);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reflection) {
      load();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getReflectionByDate(date);
      setReflection(data);
    } catch (e: any) {
      setError(e?.message ?? t("reflection.detail_load_error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!reflection) return;
    Alert.alert(
      t("reflection.detail_delete_title"),
      t("reflection.detail_delete_body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteReflection(reflection.id);
              router.back();
            } catch (e: any) {
              Alert.alert(
                t("common.error_title"),
                e?.message ?? t("reflection.detail_delete_error"),
              );
            }
          },
        },
      ],
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const isToday = date === today;

  const dateLabel = date
    ? new Date(date + "T00:00:00").toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4F8EF7" />
      </View>
    );
  }

  if (error || !reflection) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {error ?? t("reflection.detail_not_found")}
        </Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={styles.backLink}>{t("common.back_arrow")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>{t("common.back_arrow")}</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          {isToday && (
            <Pressable
              style={styles.editBtn}
              onPress={() => router.push("/(app)/reflection/today")}
            >
              <Text style={styles.editBtnText}>
                {t("reflection.detail_edit")}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t("reflection.detail_card_mood")}</Text>
        <Text style={styles.emojiLarge}>{MOOD_EMOJI[reflection.mood]}</Text>
        <Text style={styles.emojiLabel}>{moodLabel(reflection.mood)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>
          {t("reflection.detail_card_energy")}
        </Text>
        <Text style={styles.emojiLarge}>{ENERGY_EMOJI[reflection.energy]}</Text>
        <Text style={styles.emojiLabel}>{energyLabel(reflection.energy)}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{reflection.completed_count}</Text>
          <Text style={styles.statLabel}>
            {t("reflection.stat_tasks_done")}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{reflection.goal_aligned_count}</Text>
          <Text style={styles.statLabel}>{t("reflection.stat_to_goals")}</Text>
        </View>
      </View>

      {reflection.notes ? (
        <View style={styles.notesCard}>
          <Text style={styles.cardLabel}>
            {t("reflection.detail_card_notes")}
          </Text>
          <Text style={styles.notesText}>{reflection.notes}</Text>
        </View>
      ) : null}

      <Pressable style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>
          {t("reflection.detail_delete_btn")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  content: { padding: 16, paddingTop: 56, paddingBottom: 48 },
  centered: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: { marginBottom: 24 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  back: { color: "#4F8EF7", fontSize: 15, marginBottom: 12 },
  dateLabel: { color: "#fff", fontSize: 18, fontWeight: "700", flex: 1 },
  editBtn: {
    backgroundColor: "#1A2A3A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: { color: "#4F8EF7", fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  cardLabel: {
    color: "#888",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  emojiLarge: { fontSize: 44 },
  emojiLabel: { color: "#ccc", fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statBox: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statNum: { color: "#4F8EF7", fontSize: 26, fontWeight: "700" },
  statLabel: { color: "#888", fontSize: 11, textAlign: "center", marginTop: 4 },
  notesCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  notesText: { color: "#ccc", fontSize: 14, lineHeight: 22 },
  deleteBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  deleteBtnText: { color: "#ef4444", fontSize: 15, fontWeight: "600" },
  errorText: { color: "#ef4444", fontSize: 15, marginBottom: 12 },
  retryBtn: {
    borderWidth: 1,
    borderColor: "#4F8EF7",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: "#4F8EF7", fontSize: 14 },
  backLink: { color: "#4F8EF7", fontSize: 14 },
});
