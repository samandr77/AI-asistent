import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppStore, Goal } from "../../store/useAppStore";
import { listGoals } from "../../services/api";

const STATUS_TABS = [
  { key: "active", labelKey: "goals.tab_active" },
  { key: "paused", labelKey: "goals.tab_paused" },
  { key: "achieved", labelKey: "goals.tab_achieved" },
  { key: "archived", labelKey: "goals.tab_archived" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["key"];

function ProgressBar({ percent }: { percent: number }) {
  return (
    <View style={styles.progressBg}>
      <View
        style={[styles.progressFill, { width: `${Math.min(percent, 100)}%` }]}
      />
    </View>
  );
}

function GoalCard({
  goal,
  onPress,
  locale,
  t,
}: {
  goal: Goal;
  onPress: () => void;
  locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.cardTitle}>{goal.title}</Text>
      {goal.target_date && (
        <Text style={styles.cardMeta}>
          {t("goals.until_date", {
            date: new Date(goal.target_date).toLocaleDateString(locale),
          })}
        </Text>
      )}
      <ProgressBar percent={goal.progress_percent} />
      <Text style={styles.progressLabel}>{goal.progress_percent}%</Text>
    </Pressable>
  );
}

export default function Goals() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? "ru" : "en";
  const { goals, setGoals, goalsLoading, setGoalsLoading } = useAppStore();
  const [activeTab, setActiveTab] = useState<StatusTab>("active");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(
    async (status: StatusTab) => {
      setGoalsLoading(true);
      setError(null);
      try {
        const data = await listGoals({ status });
        setGoals(data);
      } catch (e: any) {
        setError(e?.message ?? t("goals.load_error"));
      } finally {
        setGoalsLoading(false);
      }
    },
    [setGoals, setGoalsLoading, t],
  );

  useEffect(() => {
    load(activeTab);
  }, [activeTab, load]);

  const filteredGoals = goals.filter((g) => g.status === activeTab);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("goals.title")}</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/(app)/goals/new")}
        >
          <Text style={styles.addBtnText}>{t("goals.add_short")}</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {STATUS_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {goalsLoading ? (
        <ActivityIndicator color="#4F8EF7" style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load(activeTab)}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : filteredGoals.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t("goals.empty_in_category")}</Text>
          {activeTab === "active" && (
            <Pressable
              style={styles.ctaBtn}
              onPress={() => router.push("/(app)/goals/new")}
            >
              <Text style={styles.ctaText}>{t("goals.create_first")}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredGoals}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => (
            <GoalCard
              goal={item}
              onPress={() => router.push(`/(app)/goals/${item.id}`)}
              locale={locale}
              t={t}
            />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={goalsLoading}
              onRefresh={() => load(activeTab)}
            />
          }
        />
      )}
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
  title: { fontSize: 24, fontWeight: "700", color: "#fff" },
  addBtn: {
    backgroundColor: "#4F8EF7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#4F8EF7" },
  tabText: { color: "#888", fontSize: 12, fontWeight: "500" },
  tabTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  cardMeta: { color: "#888", fontSize: 12, marginBottom: 8 },
  progressBg: {
    height: 4,
    backgroundColor: "#2A2A2A",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: { height: "100%", backgroundColor: "#4F8EF7", borderRadius: 2 },
  progressLabel: { color: "#888", fontSize: 11 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: { color: "#555", fontSize: 16 },
  ctaBtn: {
    backgroundColor: "#4F8EF7",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  ctaText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  errorText: { color: "#ef4444", fontSize: 15 },
  retryBtn: {
    borderWidth: 1,
    borderColor: "#4F8EF7",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: "#4F8EF7", fontSize: 14 },
});
