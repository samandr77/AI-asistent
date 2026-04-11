import { useState } from "react";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from "expo-audio";

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startRecording() {
    setError(null);
    setAudioUri(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setError("Нет разрешения на микрофон");
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
  }

  async function stopRecording(): Promise<string | null> {
    await recorder.stop();
    const uri = recorder.uri ?? null;
    setAudioUri(uri);
    setIsRecording(false);
    return uri;
  }

  return { isRecording, audioUri, error, startRecording, stopRecording };
}
