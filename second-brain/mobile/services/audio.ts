import { useState } from "react";
import { Platform } from "react-native";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from "expo-audio";

export const isVoiceRecordingSupported = Platform.OS !== "web";

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startRecording() {
    setError(null);
    setAudioUri(null);
    if (!isVoiceRecordingSupported) {
      setError("Голосовой ввод пока недоступен в desktop/web версии");
      return;
    }
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError("Нет разрешения на микрофон");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recording error");
      setIsRecording(false);
    }
  }

  async function stopRecording(): Promise<string | null> {
    if (!isVoiceRecordingSupported) {
      return null;
    }
    try {
      await recorder.stop();
      const uri = recorder.uri ?? null;
      setAudioUri(uri);
      return uri;
    } catch (e) {
      return null;
    } finally {
      setIsRecording(false);
    }
  }

  return { isRecording, audioUri, error, startRecording, stopRecording };
}
