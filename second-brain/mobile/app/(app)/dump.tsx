import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useVoiceRecorder } from "../../services/audio";
import { enqueueTextDump, enqueueVoiceDump } from "../../services/dumpQueue";
import VoiceWave from "../../components/VoiceWave";
import { isVoiceRecordingSupported } from "../../services/audio";

export default function Dump() {
  const router = useRouter();
  const { isRecording, startRecording, stopRecording, elapsedMs } =
    useVoiceRecorder();
  const remainingSec = Math.max(0, Math.ceil((180_000 - elapsedMs) / 1000));
  const [mode, setMode] = useState<"voice" | "text">(
    isVoiceRecordingSupported ? "voice" : "text",
  );
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  function handleDumpError(e: any) {
    if (e?.response?.status === 402 || e?.status === 402) {
      router.push("/(app)/paywall");
      return;
    }
    Alert.alert("Ошибка", e.message ?? "Не удалось обработать");
  }

  async function handleVoiceStop() {
    const uri = await stopRecording();
    if (!uri) return;
    setLoading(true);
    try {
      const result = await enqueueVoiceDump(uri);
      if (result) {
        router.push({
          pathname: "/(app)/result",
          params: { data: JSON.stringify(result) },
        });
      } else {
        Alert.alert(
          "Сохранено в очередь",
          "Сеть пропала — отправим когда появится связь.",
        );
        router.replace("/(app)/");
      }
    } catch (e: any) {
      handleDumpError(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleTextSubmit() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await enqueueTextDump(text.trim());
      if (result) {
        router.push({
          pathname: "/(app)/result",
          params: { data: JSON.stringify(result) },
        });
      } else {
        Alert.alert(
          "Сохранено в очередь",
          "Сеть пропала — отправим когда появится связь.",
        );
        router.replace("/(app)/");
      }
    } catch (e: any) {
      handleDumpError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        {isVoiceRecordingSupported && (
          <Pressable
            style={[styles.tab, mode === "voice" && styles.tabActive]}
            onPress={() => setMode("voice")}
          >
            <Text style={styles.tabText}>🎤 Голос</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.tab, mode === "text" && styles.tabActive]}
          onPress={() => setMode("text")}
        >
          <Text style={styles.tabText}>⌨️ Текст</Text>
        </Pressable>
      </View>

      {!isVoiceRecordingSupported && (
        <Text style={styles.desktopHint}>
          В desktop/web версии сейчас доступен текстовый ввод.
        </Text>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4F8EF7" />
          <Text style={styles.loadingText}>AI обрабатывает...</Text>
        </View>
      ) : mode === "voice" ? (
        <View style={styles.center}>
          <VoiceWave isRecording={isRecording} />
          <Pressable
            style={[styles.mic, isRecording && { backgroundColor: "#ef4444" }]}
            onPress={isRecording ? handleVoiceStop : startRecording}
          >
            <Text style={{ fontSize: 36 }}>{isRecording ? "⏹" : "🎤"}</Text>
          </Pressable>
          <Text style={styles.hint}>
            {isRecording
              ? `Осталось ${remainingSec}с — нажми чтобы остановить`
              : "Нажми чтобы начать"}
          </Text>
        </View>
      ) : (
        <View style={styles.textMode}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="Напиши всё что у тебя на уме..."
            placeholderTextColor="#555"
            multiline
            autoFocus
          />
          <Pressable style={styles.submit} onPress={handleTextSubmit}>
            <Text style={styles.submitText}>Отправить →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    padding: 16,
    paddingTop: 48,
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  tab: { flex: 1, padding: 10, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: "#4F8EF7" },
  tabText: { color: "#fff", fontSize: 15 },
  desktopHint: {
    color: "#777",
    fontSize: 13,
    marginBottom: 12,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  mic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#4F8EF7",
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { color: "#888", fontSize: 15 },
  loadingText: { color: "#888", marginTop: 16 },
  textMode: { flex: 1, gap: 16 },
  textInput: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    color: "#fff",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    textAlignVertical: "top",
  },
  submit: {
    backgroundColor: "#4F8EF7",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});
