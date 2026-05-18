import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../../store/useAppStore";
import {
  scheduleEveningReflection,
  cancelEveningReflection,
  requestPushPermission,
} from "../../../services/notifications";

export default function ReflectionSettings() {
  const router = useRouter();
  const { t } = useTranslation();
  const { reflectionReminderTime, setReflectionReminderTime } = useAppStore();

  const [enabled, setEnabled] = useState(reflectionReminderTime !== null);
  const [time, setTime] = useState(reflectionReminderTime ?? "21:00");
  const [timeInput, setTimeInput] = useState(reflectionReminderTime ?? "21:00");
  const [permissionHint, setPermissionHint] = useState(false);

  function isValidTime(t: string): boolean {
    const match = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }

  async function handleToggle(value: boolean) {
    setEnabled(value);
    if (!value) {
      await cancelEveningReflection();
      setReflectionReminderTime(null);
    } else {
      const granted = await requestPushPermission();
      if (!granted) {
        setEnabled(false);
        setPermissionHint(true);
        return;
      }
      const t = isValidTime(timeInput) ? timeInput : "21:00";
      setTime(t);
      setTimeInput(t);
      await scheduleEveningReflection(t);
      setReflectionReminderTime(t);
    }
  }

  async function handleSaveTime() {
    if (!isValidTime(timeInput)) {
      Alert.alert(
        t("reflection.settings_invalid_format_title"),
        t("reflection.settings_invalid_format_body"),
      );
      return;
    }
    const granted = await requestPushPermission();
    if (!granted) {
      setPermissionHint(true);
      return;
    }
    await cancelEveningReflection();
    await scheduleEveningReflection(timeInput);
    setTime(timeInput);
    setReflectionReminderTime(timeInput);
    Alert.alert(
      t("common.saved"),
      t("reflection.settings_saved_body", { time: timeInput }),
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>{t("common.back_arrow")}</Text>
        </Pressable>
        <Text style={styles.title}>{t("reflection.settings_title")}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>
          {t("reflection.settings_daily_label")}
        </Text>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ true: "#4F8EF7" }}
          thumbColor="#fff"
        />
      </View>

      {permissionHint && (
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            {t("reflection.settings_no_permission")}
          </Text>
        </View>
      )}

      {enabled && (
        <View style={styles.timeBlock}>
          <Text style={styles.rowLabel}>
            {t("reflection.settings_time_label")}
          </Text>
          <View style={styles.timeRow}>
            <TextInput
              style={styles.timeInput}
              value={timeInput}
              onChangeText={setTimeInput}
              placeholder="21:00"
              placeholderTextColor="#555"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <Pressable style={styles.saveBtn} onPress={handleSaveTime}>
              <Text style={styles.saveBtnText}>{t("common.save")}</Text>
            </Pressable>
          </View>
          <Text style={styles.timeHint}>
            {t("reflection.settings_current_format", { time })}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  content: { padding: 16, paddingTop: 56 },
  header: { marginBottom: 32 },
  back: { color: "#4F8EF7", fontSize: 15, marginBottom: 12 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rowLabel: { color: "#fff", fontSize: 15 },
  hintBox: {
    backgroundColor: "#1E2A1E",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  hintText: { color: "#86EFAC", fontSize: 13, lineHeight: 20 },
  timeBlock: { backgroundColor: "#1A1A1A", borderRadius: 12, padding: 16 },
  timeRow: { flexDirection: "row", gap: 10, marginTop: 10, marginBottom: 6 },
  timeInput: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
    fontWeight: "600",
  },
  saveBtn: {
    backgroundColor: "#4F8EF7",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  timeHint: { color: "#555", fontSize: 12 },
});
