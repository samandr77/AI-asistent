import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useVoiceRecorder } from "../../services/audio";
import { dumpVoice } from "../../services/api";
import { useAppStore, Task } from "../../store/useAppStore";
import { scheduleEveningReminder } from "../../services/notifications";
import VoiceWave from "../../components/VoiceWave";

export default function FirstDump() {
  const router = useRouter();
  const { setTodayTasks, setAllTasks, setOnboarded, user } = useAppStore();
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
  const [step, setStep] = useState(0);
  const [top3, setTop3] = useState<Task[]>([]);
  const [shownCount, setShownCount] = useState(0);

  async function handleStop() {
    const uri = await stopRecording();
    if (!uri) return;
    setStep(2);
    try {
      const result = await dumpVoice(uri);
      setTodayTasks(result.today_top3);
      setAllTasks(result.tasks);
      setTop3(result.today_top3);
      setStep(3);
      setShownCount(1);
    } catch {
      setStep(0);
    }
  }

  async function handleFinish() {
    if (user?.name) await scheduleEveningReminder(user.name);
    setOnboarded(true);
    router.replace("/(app)/");
  }

  if (step === 0)
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Расскажи всё что{"\n"}у тебя на уме</Text>
        <Text style={styles.sub}>Нажми на микрофон и говори свободно</Text>
        <Pressable
          style={styles.mic}
          onPress={() => {
            startRecording();
            setStep(1);
          }}
        >
          <Text style={{ fontSize: 40 }}>🎤</Text>
        </Pressable>
      </View>
    );

  if (step === 1)
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Слушаю...</Text>
        <VoiceWave isRecording={isRecording} />
        <Pressable
          style={[styles.mic, { backgroundColor: "#ef4444" }]}
          onPress={handleStop}
        >
          <Text style={{ fontSize: 32 }}>⏹</Text>
        </Pressable>
      </View>
    );

  if (step === 2)
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4F8EF7" />
        <Text style={[styles.sub, { marginTop: 24 }]}>
          AI разбирает твои мысли...
        </Text>
      </View>
    );

  if (step >= 3) {
    const allShown = shownCount >= top3.length;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Готово! 🎉</Text>
        {top3.slice(0, shownCount).map((t, i) => (
          <View key={t.id} style={styles.taskPreview}>
            <Text style={styles.taskNum}>{i + 1}.</Text>
            <Text style={styles.taskTitle}>{t.title}</Text>
          </View>
        ))}
        {allShown ? (
          <Pressable style={styles.cta} onPress={handleFinish}>
            <Text style={styles.ctaText}>Поехали! 🚀</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.next}
            onPress={() => setShownCount((c) => c + 1)}
          >
            <Text style={styles.nextText}>Далее →</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
  },
  sub: { color: "#888", fontSize: 16, textAlign: "center", marginBottom: 32 },
  mic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#4F8EF7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
  },
  taskPreview: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  taskNum: { color: "#4F8EF7", fontSize: 18, fontWeight: "700" },
  taskTitle: { color: "#fff", fontSize: 18, flex: 1 },
  cta: {
    backgroundColor: "#4F8EF7",
    borderRadius: 16,
    padding: 16,
    paddingHorizontal: 48,
    marginTop: 32,
  },
  ctaText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  next: {
    borderWidth: 1,
    borderColor: "#4F8EF7",
    borderRadius: 16,
    padding: 16,
    paddingHorizontal: 48,
    marginTop: 32,
  },
  nextText: { color: "#4F8EF7", fontSize: 16 },
});
