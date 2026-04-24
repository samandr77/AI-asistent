import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  buyPremium,
  restorePurchases,
  getPremiumStatus,
} from "../../services/purchases";
import { useAppStore } from "../../store/useAppStore";

const FEATURES = [
  { label: "Безлимитные дампы каждый день" },
  { label: "Неограниченное количество целей" },
  { label: "Полная история задач" },
  { label: "Приоритетная обработка через Claude Sonnet" },
];

export default function Paywall() {
  const router = useRouter();
  const { setPremium } = useAppStore();
  const [loading, setLoading] = useState(false);

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
      Alert.alert("Ошибка покупки", e.message ?? "Попробуй ещё раз");
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
        Alert.alert("Покупки не найдены", "Активных подписок не обнаружено.");
      }
    } catch (e: any) {
      Alert.alert("Ошибка", e.message ?? "Не удалось восстановить покупки");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeTxt}>Закрыть</Text>
      </Pressable>

      <Text style={styles.title}>Premium</Text>
      <Text style={styles.subtitle}>
        Разблокируй всё, чтобы Second Brain работал на полную
      </Text>

      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.featureRow}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.featureText}>{f.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.pricingCard}>
        <Text style={styles.price}>$4.99</Text>
        <Text style={styles.pricePeriod}>/месяц</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#9B59B6" style={styles.loader} />
      ) : (
        <>
          <Pressable style={styles.buyBtn} onPress={handleBuy}>
            <Text style={styles.buyTxt}>Начать Premium</Text>
          </Pressable>

          <Pressable style={styles.restoreBtn} onPress={handleRestore}>
            <Text style={styles.restoreTxt}>Восстановить покупки</Text>
          </Pressable>
        </>
      )}

      <Text style={styles.legal}>
        Подписка автоматически продлевается. Отмена — в настройках магазина.
      </Text>
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
});
