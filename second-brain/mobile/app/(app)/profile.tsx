import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/useAppStore";
import { api, deleteAccount, supabase } from "../../services/api";
import { signOut as authSignOut } from "../../services/auth";
import {
  buyPremium,
  restorePurchases,
  getPremiumStatus,
  logOutRevenueCat,
} from "../../services/purchases";
import {
  requestPushPermission,
  scheduleEveningReminder,
} from "../../services/notifications";

export default function Profile() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const {
    user,
    allTasks,
    setUser,
    setTodayTasks,
    setAllTasks,
    setOnboarded,
    reflectionStats,
    premium,
    setPremium,
  } = useAppStore();
  const hasPremium = premium.is_premium;
  const [memories, setMemories] = useState<any[]>([]);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    getPremiumStatus()
      .then(setPremium)
      .catch(() => {});
    loadMemories();
    loadProvider();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProvider() {
    try {
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser();
      const p = (sbUser?.app_metadata as Record<string, unknown> | undefined)
        ?.provider;
      setProvider(typeof p === "string" ? p : null);
    } catch {
      // non-critical
    }
  }

  async function loadMemories() {
    try {
      const { data } = await api.get("/memory/profile");
      setMemories(data.slice(0, 5));
    } catch (e) {
      if (__DEV__) console.warn("loadMemories failed:", e);
    }
  }

  async function handleSignOut() {
    try {
      await authSignOut();
    } catch {
      /* ignore */
    }
    setUser(null);
    setTodayTasks([]);
    setAllTasks([]);
    setOnboarded(false);
  }

  function confirmDeleteAccount() {
    const subscriptionWarning =
      premium.is_premium && !premium.cancelled
        ? "\n\n" + t("profile.delete_active_subscription_warning")
        : "";
    Alert.alert(
      t("profile.delete_title"),
      t("profile.delete_body") + subscriptionWarning,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.delete_confirm"),
          style: "destructive",
          onPress: handleDeleteAccount,
        },
      ],
    );
  }

  async function handleDeleteAccount() {
    try {
      await deleteAccount();
    } catch (err: any) {
      const msg = err?.message ?? t("profile.delete_error_body");
      Alert.alert(t("profile.delete_error_title"), msg);
      return;
    }
    try {
      await logOutRevenueCat();
    } catch {
      /* ignore */
    }
    useAppStore.getState().resetAll();
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    router.replace("/(onboarding)/welcome");
  }

  async function handleBuyPremium() {
    const ok = await buyPremium();
    if (ok) {
      const status = await getPremiumStatus();
      setPremium(status);
    }
  }

  async function handleRestorePurchases() {
    const ok = await restorePurchases();
    if (ok) {
      const status = await getPremiumStatus();
      setPremium(status);
    }
  }

  const doneCount = allTasks.filter((t) => t.is_done).length;
  const totalCount = allTasks.length;
  const locale = i18n.language === "ru" ? "ru-RU" : "en-US";

  const providerLabel =
    provider === "apple"
      ? t("profile.signed_in_apple")
      : provider === "google"
        ? t("profile.signed_in_google")
        : provider != null
          ? t("profile.signed_in_other", { provider })
          : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {user?.name?.[0]?.toUpperCase() ?? "?"}
        </Text>
      </View>
      <Text style={styles.name}>{user?.name ?? t("common.user_fallback")}</Text>

      {providerLabel != null && (
        <View style={styles.providerBadge}>
          <Text style={styles.providerBadgeText}>{providerLabel}</Text>
        </View>
      )}

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{totalCount}</Text>
          <Text style={styles.statLabel}>{t("profile.stats_tasks")}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{doneCount}</Text>
          <Text style={styles.statLabel}>{t("profile.stats_completed")}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>
            {totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%
          </Text>
          <Text style={styles.statLabel}>{t("profile.stats_progress")}</Text>
        </View>
      </View>

      {hasPremium ? (
        <View style={styles.premiumBadgeRow}>
          <Text style={styles.premiumBadge}>{t("profile.premium_active")}</Text>
          {premium.expires_at && (
            <Text style={styles.premiumExpiry}>
              {t("profile.premium_until", {
                date: new Date(premium.expires_at).toLocaleDateString(locale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              })}
            </Text>
          )}
        </View>
      ) : (
        <Pressable style={styles.premium} onPress={handleBuyPremium}>
          <Text style={styles.premiumText}>{t("profile.premium_cta")}</Text>
        </Pressable>
      )}

      <Pressable
        style={styles.row}
        onPress={async () => {
          const ok = await requestPushPermission();
          if (ok && user?.name) await scheduleEveningReminder(user.name);
          Alert.alert(
            ok
              ? t("profile.notifications_granted")
              : t("profile.notifications_denied"),
          );
        }}
      >
        <Text style={styles.rowText}>{t("profile.row_notifications")}</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={handleRestorePurchases}>
        <Text style={styles.rowText}>{t("profile.row_restore_purchases")}</Text>
      </Pressable>

      <Pressable
        style={styles.row}
        onPress={() => router.push("/(app)/reflection/settings")}
      >
        <View style={styles.rowInner}>
          <Text style={styles.rowText}>{t("profile.row_reflection")}</Text>
          {(reflectionStats?.current_streak ?? 0) > 0 && (
            <Text style={styles.streakBadge}>
              {t("profile.streak_days_short", {
                count: reflectionStats!.current_streak,
              })}
            </Text>
          )}
        </View>
      </Pressable>

      <Pressable style={[styles.row, styles.signOut]} onPress={handleSignOut}>
        <Text style={[styles.rowText, { color: "#ef4444" }]}>
          {t("profile.row_sign_out")}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.row, styles.deleteAccount]}
        onPress={confirmDeleteAccount}
      >
        <Text style={[styles.rowText, { color: "#ef4444", fontWeight: "600" }]}>
          {t("profile.row_delete_account")}
        </Text>
      </Pressable>

      {memories.length > 0 && (
        <View style={styles.memoriesSection}>
          <Text style={styles.memoriesTitle}>
            {t("profile.ai_context_title")}
          </Text>
          {memories.map((m, i) => (
            <Text key={i} style={styles.memoryItem}>
              {m.content}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  content: { padding: 24, paddingTop: 64, alignItems: "center" },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4F8EF7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#fff", fontSize: 32, fontWeight: "700" },
  name: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 8 },
  providerBadge: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  providerBadgeText: { color: "#888", fontSize: 13 },
  stats: { flexDirection: "row", gap: 32, marginBottom: 32 },
  statItem: { alignItems: "center" },
  statNum: { color: "#fff", fontSize: 24, fontWeight: "700" },
  statLabel: { color: "#888", fontSize: 12 },
  premiumBadgeRow: { alignItems: "center", marginBottom: 24, gap: 4 },
  premiumBadge: { color: "#f59e0b", fontSize: 16, fontWeight: "600" },
  premiumExpiry: { color: "#888", fontSize: 12 },
  premium: {
    backgroundColor: "#9B59B6",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
  },
  premiumText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  row: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 8,
  },
  rowText: { color: "#fff", fontSize: 15 },
  rowInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streakBadge: { color: "#f59e0b", fontSize: 13, fontWeight: "600" },
  signOut: { marginTop: 8 },
  deleteAccount: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#7a1e1e",
    backgroundColor: "#1f0d0d",
  },
  memoriesSection: { width: "100%", marginTop: 24 },
  memoriesTitle: {
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  memoryItem: {
    color: "#555",
    fontSize: 13,
    marginBottom: 4,
  },
});
