import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useVoiceRecorder } from "../../services/audio";
import { dumpText, dumpVoice, upsertProfile } from "../../services/api";
import { useAppStore, Task } from "../../store/useAppStore";
import { scheduleEveningReminder } from "../../services/notifications";
import VoiceWave from "../../components/VoiceWave";
import { isVoiceRecordingSupported } from "../../services/audio";

export default function FirstDump() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setTodayTasks, setAllTasks, setOnboarded, setUser, user } =
    useAppStore();
  const { isRecording, error, startRecording, stopRecording } =
    useVoiceRecorder();
  const [step, setStep] = useState(0);
  const [top3, setTop3] = useState<Task[]>([]);
  const [shownCount, setShownCount] = useState(0);
  const [textDump, setTextDump] = useState("");

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
    } catch (e: any) {
      Alert.alert(
        t("common.error_title"),
        e.message ?? t("onboarding.first_voice_error_body"),
      );
      setStep(0);
    }
  }

  async function handleTextSubmit() {
    if (!textDump.trim()) return;
    setStep(2);
    try {
      const result = await dumpText(textDump.trim());
      setTodayTasks(result.today_top3);
      setAllTasks(result.tasks);
      setTop3(result.today_top3);
      setStep(3);
      setShownCount(1);
    } catch (e: any) {
      Alert.alert(
        t("common.error_title"),
        e.message ?? t("onboarding.first_text_error_body"),
      );
      setStep(0);
    }
  }

  async function handleFinish() {
    try {
      const profile = await upsertProfile({ is_onboarded: true });
      if (user?.name) await scheduleEveningReminder(user.name);
      setOnboarded(true);
      if (user) {
        setUser({ ...user, ...profile, email: user.email, is_onboarded: true });
      }
      router.replace("/(app)/");
    } catch (e: any) {
      Alert.alert(
        t("common.error_title"),
        e.message ?? t("onboarding.first_finish_error_body"),
      );
    }
  }

  if (step === 0)
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t("onboarding.first_title")}</Text>
        {isVoiceRecordingSupported ? (
          <>
            <Text style={styles.sub}>{t("onboarding.first_voice_hint")}</Text>
            <Pressable
              style={styles.mic}
              onPress={async () => {
                await startRecording();
                if (error) {
                  Alert.alert(t("common.error_title"), error);
                  return;
                }
                setStep(1);
              }}
            >
              <Text style={{ fontSize: 40 }}>🎤</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.textBox}>
            <Text style={styles.sub}>{t("onboarding.first_text_only")}</Text>
            <TextInput
              style={styles.textInput}
              value={textDump}
              onChangeText={setTextDump}
              placeholder={t("onboarding.first_text_placeholder")}
              placeholderTextColor="#555"
              multiline
              autoFocus
            />
            <Pressable style={styles.textSubmit} onPress={handleTextSubmit}>
              <Text style={styles.textSubmitText}>
                {t("onboarding.first_text_submit")}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );

  if (step === 1)
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t("onboarding.first_listening")}</Text>
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
          {t("onboarding.first_ai_thinking")}
        </Text>
      </View>
    );

  if (step >= 3) {
    const allShown = shownCount >= top3.length;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>{t("onboarding.first_ready")}</Text>
        {top3.slice(0, shownCount).map((task, i) => (
          <View key={task.id} style={styles.taskPreview}>
            <Text style={styles.taskNum}>{i + 1}.</Text>
            <Text style={styles.taskTitle}>{task.title}</Text>
          </View>
        ))}
        {allShown ? (
          <Pressable style={styles.cta} onPress={handleFinish}>
            <Text style={styles.ctaText}>{t("onboarding.first_lets_go")}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.next}
            onPress={() => setShownCount((c) => c + 1)}
          >
            <Text style={styles.nextText}>{t("common.next_arrow")}</Text>
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
  textBox: {
    width: "100%",
    gap: 16,
  },
  textInput: {
    minHeight: 180,
    backgroundColor: "#141414",
    color: "#fff",
    borderRadius: 18,
    padding: 16,
    fontSize: 16,
    textAlignVertical: "top",
  },
  textSubmit: {
    backgroundColor: "#4F8EF7",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  textSubmitText: { color: "#fff", fontSize: 16, fontWeight: "600" },
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
