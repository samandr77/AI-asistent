import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "../../../store/useAppStore";
import { createGoal } from "../../../services/api";
import { SPHERES } from "../../../constants/spheres";

const STATUSES = [
  { key: "active", label: "Активна" },
  { key: "paused", label: "Пауза" },
] as const;

export default function NewGoal() {
  const { addGoal } = useAppStore();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [sphere, setSphere] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"active" | "paused">("active");
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  function validate(): boolean {
    let valid = true;
    setTitleError(null);
    setDateError(null);

    if (!title.trim()) {
      setTitleError("Название обязательно");
      valid = false;
    } else if (title.trim().length > 200) {
      setTitleError("Не более 200 символов");
      valid = false;
    }

    if (targetDate) {
      const d = new Date(targetDate);
      if (isNaN(d.getTime())) {
        setDateError("Введите дату в формате ГГГГ-ММ-ДД");
        valid = false;
      } else if (d < new Date(new Date().toDateString())) {
        setDateError("Дата не может быть в прошлом");
        valid = false;
      }
    }

    return valid;
  }

  async function handleCreate() {
    if (!validate()) return;
    setLoading(true);
    try {
      const goal = await createGoal({
        title: title.trim(),
        description: description.trim() || undefined,
        target_date: targetDate || undefined,
        sphere: sphere || undefined,
        status,
      });
      addGoal(goal);
      router.back();
    } catch (e: any) {
      Alert.alert("Ошибка", e?.message ?? "Не удалось создать цель");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Новая цель</Text>

      <Text style={styles.label}>Название *</Text>
      <TextInput
        style={[styles.input, titleError ? styles.inputError : null]}
        placeholder="Например: Запустить продукт"
        placeholderTextColor="#555"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          setTitleError(null);
        }}
        maxLength={200}
      />
      {titleError && <Text style={styles.fieldError}>{titleError}</Text>}

      <Text style={styles.label}>Описание</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Зачем эта цель?"
        placeholderTextColor="#555"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        maxLength={2000}
      />

      <Text style={styles.label}>Целевая дата (ГГГГ-ММ-ДД)</Text>
      <TextInput
        style={[styles.input, dateError ? styles.inputError : null]}
        placeholder="2026-12-31"
        placeholderTextColor="#555"
        value={targetDate}
        onChangeText={(v) => {
          setTargetDate(v);
          setDateError(null);
        }}
        keyboardType="numbers-and-punctuation"
      />
      {dateError && <Text style={styles.fieldError}>{dateError}</Text>}

      <Text style={styles.label}>Сфера</Text>
      <View style={styles.pillRow}>
        {SPHERES.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.pill, sphere === s.id && styles.pillActive]}
            onPress={() => setSphere(sphere === s.id ? undefined : s.id)}
          >
            <Text
              style={[
                styles.pillText,
                sphere === s.id && styles.pillTextActive,
              ]}
            >
              {s.icon} {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Статус</Text>
      <View style={styles.pillRow}>
        {STATUSES.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.pill, status === s.key && styles.pillActive]}
            onPress={() => setStatus(s.key)}
          >
            <Text
              style={[
                styles.pillText,
                status === s.key && styles.pillTextActive,
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.submitBtn}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Создать цель</Text>
        )}
      </Pressable>

      <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Отмена</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  content: { padding: 24, paddingTop: 64, paddingBottom: 40 },
  heading: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 24 },
  label: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    color: "#fff",
    fontSize: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  inputError: { borderColor: "#ef4444" },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  fieldError: { color: "#ef4444", fontSize: 12, marginTop: 4 },
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
  submitBtn: {
    backgroundColor: "#4F8EF7",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 32,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtn: { marginTop: 12, alignItems: "center", paddingVertical: 12 },
  cancelText: { color: "#555", fontSize: 15 },
});
