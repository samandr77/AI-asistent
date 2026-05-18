import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/useAppStore";
import { upsertProfile } from "../../services/api";

type Role = "mom" | "freelancer" | "student" | "entrepreneur" | "other";
type PeakHours = "morning" | "afternoon" | "evening";

const ROLES: { id: Role; labelKey: string }[] = [
  { id: "mom", labelKey: "onboarding.setup_role_mom" },
  { id: "freelancer", labelKey: "onboarding.setup_role_freelancer" },
  { id: "student", labelKey: "onboarding.setup_role_student" },
  { id: "entrepreneur", labelKey: "onboarding.setup_role_entrepreneur" },
  { id: "other", labelKey: "onboarding.setup_role_other" },
];

const PEAK_HOURS: { id: PeakHours; labelKey: string }[] = [
  { id: "morning", labelKey: "onboarding.setup_peak_morning" },
  { id: "afternoon", labelKey: "onboarding.setup_peak_afternoon" },
  { id: "evening", labelKey: "onboarding.setup_peak_evening" },
];

export default function Setup() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setUser, setOnboarded, user } = useAppStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHours | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    if (step === 0) {
      if (name.trim() === "") return;
      setStep(step + 1);
      return;
    }
    if (step === 1) {
      if (role === null) return;
      setStep(step + 1);
      return;
    }
    if (peakHours === null) return;
    if (!user) {
      Alert.alert(t("onboarding.setup_need_login"));
      router.replace("/(onboarding)/welcome");
      return;
    }

    setLoading(true);

    try {
      setUser({ ...user, name, role: role!, peak_hours: peakHours! });
      setOnboarded(false);

      const profile = await upsertProfile({
        name,
        role: role ?? undefined,
        peak_hours: peakHours,
        is_onboarded: false,
      });
      setUser({
        ...user,
        ...profile,
        email: user.email,
      });
      router.push("/(onboarding)/first-dump");
    } catch (e: any) {
      Alert.alert(
        t("common.error_title"),
        e.message ?? t("onboarding.setup_save_error"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {step === 0 && (
        <>
          <Text style={styles.title}>{t("onboarding.setup_q_name")}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("onboarding.setup_name_placeholder")}
            placeholderTextColor="#555"
            autoFocus
          />
        </>
      )}
      {step === 1 && (
        <>
          <Text style={styles.title}>{t("onboarding.setup_q_role")}</Text>
          {ROLES.map((r) => (
            <Pressable
              key={r.id}
              style={[styles.chip, role === r.id && styles.chipActive]}
              onPress={() => setRole(r.id)}
            >
              <Text style={styles.chipText}>{t(r.labelKey)}</Text>
            </Pressable>
          ))}
        </>
      )}
      {step === 2 && (
        <>
          <Text style={styles.title}>{t("onboarding.setup_q_peak")}</Text>
          {PEAK_HOURS.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.chip, peakHours === p.id && styles.chipActive]}
              onPress={() => setPeakHours(p.id)}
            >
              <Text style={styles.chipText}>{t(p.labelKey)}</Text>
            </Pressable>
          ))}
        </>
      )}
      <Pressable
        style={[styles.next, loading && styles.nextDisabled]}
        onPress={handleNext}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.nextText}>
            {step < 2 ? t("common.next_arrow") : t("onboarding.setup_continue")}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 32,
    paddingTop: 80,
  },
  title: { fontSize: 28, fontWeight: "700", color: "#fff", marginBottom: 32 },
  input: {
    backgroundColor: "#1A1A1A",
    color: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
  },
  chip: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipActive: { borderColor: "#4F8EF7" },
  chipText: { color: "#fff", fontSize: 16 },
  next: {
    backgroundColor: "#4F8EF7",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 32,
  },
  nextDisabled: { opacity: 0.7 },
  nextText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});
