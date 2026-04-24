import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from "expo-audio";

export const isVoiceRecordingSupported = Platform.OS !== "web";
export const MAX_RECORDING_MS = 180_000;

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  async function stopRecording(): Promise<string | null> {
    if (!isVoiceRecordingSupported) return null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    try {
      await recorder.stop();
      const uri = recorder.uri ?? null;
      setAudioUri(uri);
      return uri;
    } catch {
      return null;
    } finally {
      setIsRecording(false);
      startedAt.current = null;
    }
  }

  async function startRecording() {
    setError(null);
    setAudioUri(null);
    setElapsedMs(0);
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
      startedAt.current = Date.now();
      tickRef.current = setInterval(() => {
        if (startedAt.current) setElapsedMs(Date.now() - startedAt.current);
      }, 250);
      timeoutRef.current = setTimeout(() => {
        void stopRecording();
      }, MAX_RECORDING_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recording error");
      setIsRecording(false);
    }
  }

  return {
    isRecording,
    audioUri,
    error,
    elapsedMs,
    startRecording,
    stopRecording,
  };
}
