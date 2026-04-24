import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppStore, Task } from "../../../store/useAppStore";
import { updateTask, deleteTask } from "../../../services/api";
import { SPHERE_MAP } from "../../../constants/spheres";

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    allTasks,
    todayTasks,
    updateTask: updateStore,
    deleteTask: deleteStore,
  } = useAppStore();
  const router = useRouter();
  const task = [...allTasks, ...todayTasks].find((t) => t.id === id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task?.title ?? "");

  if (!task) return null;

  async function handleDone() {
    try {
      await updateTask(id!, { is_done: true });
      updateStore(id!, { is_done: true });
      router.back();
    } catch (e: any) {
      Alert.alert("Ошибка", e.message ?? "Не удалось обновить задачу");
    }
  }

  async function handleSaveTitle() {
    try {
      await updateTask(id!, { title });
      updateStore(id!, { title });
      setEditing(false);
    } catch (e: any) {
      Alert.alert("Ошибка", e.message ?? "Не удалось сохранить");
    }
  }

  async function handleDelete() {
    Alert.alert("Удалить задачу?", task!.title, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          if (!id) return;
          try {
            await deleteTask(id!);
            deleteStore(id!);
            router.back();
          } catch (e: any) {
            Alert.alert("Ошибка", e.message ?? "Не удалось удалить задачу");
          }
        },
      },
    ]);
  }

  const sphere = SPHERE_MAP[task.sphere];

  return (
    <View style={styles.container}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Назад</Text>
      </Pressable>

      <View
        style={[styles.spherePill, { backgroundColor: sphere.color + "33" }]}
      >
        <Text style={{ color: sphere.color }}>
          {sphere.icon} {sphere.label}
        </Text>
      </View>

      {editing ? (
        <>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
          <Pressable onPress={handleSaveTitle}>
            <Text style={styles.save}>Сохранить</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={() => setEditing(true)}>
          <Text style={styles.title}>{task.title}</Text>
        </Pressable>
      )}

      {task.notes && <Text style={styles.notes}>{task.notes}</Text>}
      {task.deadline && (
        <Text style={styles.meta}>
          📅 {new Date(task.deadline).toLocaleString("ru")}
        </Text>
      )}
      {task.reminder_at && (
        <Text style={styles.meta}>
          🔔 {new Date(task.reminder_at).toLocaleString("ru")}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.doneBtn} onPress={handleDone}>
          <Text style={styles.doneBtnText}>✓ Выполнено</Text>
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>🗑 Удалить</Text>
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
  },
  back: { marginBottom: 24 },
  backText: { color: "#4F8EF7", fontSize: 16 },
  spherePill: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 12 },
  titleInput: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  save: { color: "#4F8EF7", fontSize: 16, marginBottom: 12 },
  notes: { color: "#888", fontSize: 15, marginBottom: 8 },
  meta: { color: "#666", fontSize: 14, marginBottom: 4 },
  actions: { position: "absolute", bottom: 40, left: 24, right: 24, gap: 12 },
  doneBtn: {
    backgroundColor: "#2ECC71",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  doneBtnText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  deleteBtn: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  deleteBtnText: { color: "#ef4444", fontSize: 16 },
});
