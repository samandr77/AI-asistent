import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { dumpVoiceRaw } from "../../services/api";
import { enqueueTextDump } from "../../services/dumpQueue";
import {
  type RecorderSession,
  isVoiceRecordingSupported,
  startVoiceRecording,
} from "../../services/recorder";
import { notify, selectionChanged } from "../../telegram/haptics";

const maxVoiceBytes = 25 * 1024 * 1024;
const maxVoiceSeconds = 180;

export function DumpScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const recorderRef = useRef<RecorderSession | null>(null);
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [queued, setQueued] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const voiceSupported = isVoiceRecordingSupported();

  const textMutation = useMutation({
    mutationFn: enqueueTextDump,
    onSuccess: (result) => {
      setText("");
      if (result) {
        notify("success");
        navigate(`/dump/result?dump_id=${encodeURIComponent(result.dump_id)}`, {
          state: { result },
        });
      } else {
        setQueued(true);
      }
    },
    onError: () => {
      notify("error");
    },
  });

  const voiceMutation = useMutation({
    mutationFn: dumpVoiceRaw,
    onSuccess: (result) => {
      notify("success");
      navigate(`/dump/result?dump_id=${encodeURIComponent(result.dump_id)}`, {
        state: { result },
      });
    },
    onError: () => {
      notify("error");
    },
  });

  async function submitText() {
    if (!text.trim() || textMutation.isPending) return;
    setQueued(false);
    await textMutation.mutateAsync(text);
  }

  async function toggleRecording() {
    selectionChanged();
    if (isRecording && recorderRef.current) {
      const audio = await recorderRef.current.stop();
      recorderRef.current = null;
      setIsRecording(false);
      const durationSeconds = recordingStartedAtRef.current
        ? (Date.now() - recordingStartedAtRef.current) / 1000
        : 0;
      recordingStartedAtRef.current = null;
      if (durationSeconds > maxVoiceSeconds || audio.size > maxVoiceBytes) {
        setVoiceError(t("dump.voiceTooLarge"));
        notify("error");
        return;
      }
      setVoiceError(null);
      voiceMutation.mutate(audio);
      return;
    }

    recorderRef.current = await startVoiceRecording();
    recordingStartedAtRef.current = Date.now();
    setVoiceError(null);
    setIsRecording(true);
  }

  const isPending = textMutation.isPending || voiceMutation.isPending;

  return (
    <main className="screen">
      <section className="panel stack">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("screens.dump")}</h1>

        <div className="segmented" role="tablist" aria-label="Способ записи">
          <button
            className={mode === "text" ? "active" : ""}
            type="button"
            onClick={() => setMode("text")}
          >
            {t("dump.text")}
          </button>
          <button
            className={mode === "voice" ? "active" : ""}
            disabled={!voiceSupported}
            type="button"
            onClick={() => setMode("voice")}
          >
            {t("dump.voice")}
          </button>
        </div>

        {mode === "text" ? (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void submitText();
            }}
          >
            <textarea
              className="dump-input"
              maxLength={20_000}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("dump.placeholder")}
              value={text}
            />
            <button className="button" disabled={!text.trim() || isPending}>
              {isPending ? t("common.loading") : t("dump.submit")}
            </button>
          </form>
        ) : (
          <div className="stack">
            {!voiceSupported ? (
              <p className="muted">{t("dump.voiceUnsupported")}</p>
            ) : null}
            <button
              className={isRecording ? "button danger" : "button"}
              disabled={!voiceSupported || isPending}
              type="button"
              onClick={() => void toggleRecording()}
            >
              {isRecording ? t("dump.stopRecording") : t("dump.startRecording")}
            </button>
          </div>
        )}

        {queued ? <p className="status">{t("dump.queued")}</p> : null}
        {voiceError ? <p className="error-text">{voiceError}</p> : null}
        {textMutation.error || voiceMutation.error ? (
          <p className="error-text">{t("dump.error")}</p>
        ) : null}
      </section>
    </main>
  );
}
