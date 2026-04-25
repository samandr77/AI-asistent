import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import {
  buyPremium,
  restorePurchases,
  getPremiumStatus,
} from "../../services/purchases";
import { useAppStore } from "../../store/useAppStore";

const FALLBACK_PRIVACY_URL = "https://second-brain.app/privacy";
const FALLBACK_TERMS_URL = "https://second-brain.app/terms";

function getLegalUrl(key: "privacyUrl" | "termsUrl"): string {
  const extra = Constants.expoConfig?.extra as
    | Record<string, string>
    | undefined;
  const fallback =
    key === "privacyUrl" ? FALLBACK_PRIVACY_URL : FALLBACK_TERMS_URL;
  const value = extra?.[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export default function Paywall() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setPremium } = useAppStore();
  const [loading, setLoading] = useState(false);

  const features = [
    t("paywall.feature_unlimited_dumps"),
    t("paywall.feature_unlimited_goals"),
    t("paywall.feature_full_history"),
    t("paywall.feature_priority_ai"),
  ];

  async function handleBuy() {
    setLoading(true);
    try {
      const ok = await buyPremium();
      if (ok) {
        const status = await getPremiumStatus();
        setPremium(status);
        router.back();
      }
    } catch (e: any) {
      Alert.alert(
        t("paywall.buy_error_title"),
        e.message ?? t("paywall.buy_error_body"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    try {
      const ok = await restorePurchases();
      if (ok) {
        const status = await getPremiumStatus();
        setPremium(status);
        router.back();
      } else {
        Alert.alert(
          t("paywall.restore_not_found_title"),
          t("paywall.restore_not_found_body"),
        );
      }
    } catch (e: any) {
      Alert.alert(
        t("paywall.restore_error_title"),
        e.message ?? t("paywall.restore_error_body"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeTxt}>{t("common.close")}</Text>
      </Pressable>

      <Text style={styles.title}>{t("paywall.title")}</Text>
      <Text style={styles.subtitle}>{t("paywall.subtitle")}</Text>

      <View style={styles.features}>
        {features.map((label) => (
          <View key={label} style={styles.featureRow}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.featureText}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.pricingCard}>
        <Text style={styles.price}>$4.99</Text>
        <Text style={styles.pricePeriod}>{t("paywall.price_per_month")}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#9B59B6" style={styles.loader} />
      ) : (
        <>
          <Pressable style={styles.buyBtn} onPress={handleBuy}>
            <Text style={styles.buyTxt}>{t("paywall.buy")}</Text>
          </Pressable>

          <Pressable style={styles.restoreBtn} onPress={handleRestore}>
            <Text style={styles.restoreTxt}>{t("paywall.restore")}</Text>
          </Pressable>
        </>
      )}

      <Text style={styles.legal}>{t("paywall.legal_footer")}</Text>

      <View style={styles.legalLinks}>
        <Pressable onPress={() => Linking.openURL(getLegalUrl("privacyUrl"))}>
          <Text style={styles.legalLink}>{t("paywall.legal_privacy")}</Text>
        </Pressable>
        <Text style={styles.legalDivider}>·</Text>
        <Pressable onPress={() => Linking.openURL(getLegalUrl("termsUrl"))}>
          <Text style={styles.legalLink}>{t("paywall.legal_terms")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 24,
    paddingTop: 64,
    alignItems: "center",
  },
  closeBtn: { position: "absolute", top: 56, right: 24 },
  closeTxt: { color: "#666", fontSize: 15 },
  title: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    marginTop: 40,
    marginBottom: 8,
  },
  subtitle: {
    color: "#888",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 22,
  },
  features: { width: "100%", gap: 16, marginBottom: 40 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkmark: { color: "#9B59B6", fontSize: 18, fontWeight: "700" },
  featureText: { color: "#fff", fontSize: 15 },
  pricingCard: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 32,
    gap: 4,
  },
  price: { color: "#fff", fontSize: 48, fontWeight: "800" },
  pricePeriod: { color: "#888", fontSize: 18 },
  loader: { marginVertical: 24 },
  buyBtn: {
    backgroundColor: "#9B59B6",
    borderRadius: 16,
    padding: 18,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  buyTxt: { color: "#fff", fontSize: 18, fontWeight: "700" },
  restoreBtn: { padding: 12 },
  restoreTxt: { color: "#666", fontSize: 14 },
  legal: {
    color: "#444",
    fontSize: 11,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 16,
  },
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  legalLink: {
    color: "#888",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  legalDivider: { color: "#444", fontSize: 12 },
});
