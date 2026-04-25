import { useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  ListRenderItemInfo,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppStore, Reflection } from "../../../store/useAppStore";
import { listReflections } from "../../../services/api";

const MOOD_EMOJI = ["", "😞", "😕", "😐", "🙂", "😄"];
const ENERGY_EMOJI = ["", "😴", "😒", "😌", "⚡", "🔥"];
const ITEM_HEIGHT = 76;

function ReflectionRow({
  item,
  onPress,
  locale,
}: {
  item: Reflection;
  onPress: () => void;
  locale: string;
}) {
  const dateLabel = new Date(item.date + "T00:00:00").toLocaleDateString(
    locale,
    {
      day: "numeric",
      month: "long",
      weekday: "short",
    },
  );
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowDate}>{dateLabel}</Text>
        {item.notes ? (
          <Text style={styles.rowNotes} numberOfLines={1}>
            {item.notes}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowEmoji}>
          {MOOD_EMOJI[item.mood]} {ENERGY_EMOJI[item.energy]}
        </Text>
        {item.goal_aligned_count > 0 && (
          <Text style={styles.goalAlignedBadge}>
            🎯 {item.goal_aligned_count}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function ReflectionList() {
  const {
    reflections,
    setReflections,
    reflectionsLoading,
    setReflectionsLoading,
    reflectionStats,
  } = useAppStore();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? "ru" : "en";

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const hasYesterday = reflections.some((r) => r.date === yesterday);
  const hasToday = reflections.some((r) => r.date === today);

  const load = useCallback(async () => {
    setReflectionsLoading(true);
    try {
      const data = await listReflections({ limit: 30 });
      setReflections(data);
    } catch {
      // keep stale cache; user can pull-to-refresh
    } finally {
      setReflectionsLoading(false);
    }
  }, [setReflections, setReflectionsLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const getItemLayout = (
    _: ArrayLike<Reflection> | null | undefined,
    index: number,
  ) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("reflection.title")}</Text>
        {reflectionStats && reflectionStats.current_streak > 0 && (
          <Text style={styles.streak}>
            {t("reflection.streak_days_short", {
              count: reflectionStats.current_streak,
            })}
          </Text>
        )}
      </View>

      {!hasYesterday && !hasToday && reflections.length > 0 && (
        <Pressable
          style={styles.backfillBanner}
          onPress={() => router.push(`/(app)/reflection/${yesterday}`)}
        >
          <Text style={styles.backfillText}>
            {t("reflection.add_yesterday")}
          </Text>
        </Pressable>
      )}

      {reflectionsLoading && reflections.length === 0 ? (
        <ActivityIndicator color="#4F8EF7" style={{ marginTop: 40 }} />
      ) : reflections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("reflection.empty")}</Text>
          <Text style={styles.emptyHint}>{t("reflection.empty_hint")}</Text>
          <Pressable
            style={styles.ctaBtn}
            onPress={() => router.push("/(app)/reflection/today")}
          >
            <Text style={styles.ctaText}>{t("reflection.start_today")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={reflections}
          keyExtractor={(r) => r.id}
          renderItem={({ item }: ListRenderItemInfo<Reflection>) => (
            <ReflectionRow
              item={item}
              locale={locale}
              onPress={() => router.push(`/(app)/reflection/${item.date}`)}
            />
          )}
          getItemLayout={getItemLayout}
          windowSize={5}
          refreshControl={
            <RefreshControl refreshing={reflectionsLoading} onRefresh={load} />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => router.push("/(app)/reflection/today")}
      >
        <Text style={styles.fabText}>{t("reflection.fab_today")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A", padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 48,
    marginBottom: 16,
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "700" },
  streak: { color: "#f59e0b", fontSize: 14, fontWeight: "600" },
  backfillBanner: {
    backgroundColor: "#1E2A3A",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  backfillText: { color: "#93C5FD", fontSize: 14 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    height: ITEM_HEIGHT,
  },
  rowLeft: { flex: 1, marginRight: 12 },
  rowDate: { color: "#fff", fontSize: 14, fontWeight: "600" },
  rowNotes: { color: "#888", fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rowEmoji: { fontSize: 18 },
  goalAlignedBadge: { color: "#93C5FD", fontSize: 11, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { color: "#555", fontSize: 16 },
  emptyHint: { color: "#333", fontSize: 13 },
  ctaBtn: {
    backgroundColor: "#4F8EF7",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  ctaText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 16,
    backgroundColor: "#4F8EF7",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
