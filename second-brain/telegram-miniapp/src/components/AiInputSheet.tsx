import { useEffect, useRef, useState } from "react";

import { Icon } from "../screens/tasks/components/Icon";
import { dumpPhotoRaw, dumpTextRaw, dumpVoiceRaw } from "../services/api";
import type { DumpTextResponse } from "../types/api";

type Status = "idle" | "sending" | "recording" | "success" | "error";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AiInputSheet({ open, onClose }: Props) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    } else {
      setText("");
      setStatus("idle");
      setMessage(null);
      stopRecording();
    }
  }, [open]);

  useEffect(() => {
    if (status !== "success" && status !== "error") return;
    const timer = setTimeout(() => {
      setStatus("idle");
      setMessage(null);
      if (status === "success") onClose();
    }, 1800);
    return () => clearTimeout(timer);
  }, [status, onClose]);

  useEffect(() => {
    if (!open) return;
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function flashSuccess(msg: string) {
    setStatus("success");
    setMessage(msg);
  }
  function flashError(err: unknown) {
    setStatus("error");
    setMessage(err instanceof Error ? err.message : "Не удалось отправить");
  }

  function resultMessage(prefix: string, res: DumpTextResponse): string {
    const tasks = res.tasks?.length ?? 0;
    const health = res.saved_health_events?.length ?? 0;
    const pending = res.pending_health_events?.length ?? 0;
    const parts = [];
    if (tasks) parts.push(`задач: ${tasks}`);
    if (health) parts.push(`здоровье: ${health}`);
    if (pending) parts.push(`на проверку: ${pending}`);
    return parts.length ? `${prefix} → ${parts.join(" · ")}` : `${prefix} записан`;
  }

  async function sendText() {
    const value = text.trim();
    if (!value || status === "sending") return;
    setStatus("sending");
    setMessage(null);
    try {
      const res = await dumpTextRaw(value);
      setText("");
      flashSuccess(resultMessage("Текст", res));
    } catch (err) {
      flashError(err);
    }
  }

  async function startRecording() {
    if (status === "recording" || status === "sending") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      flashError(new Error("Запись голоса не поддерживается"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        audioStreamRef.current?.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        if (blob.size === 0) {
          setStatus("idle");
          return;
        }
        setStatus("sending");
        try {
          const res = await dumpVoiceRaw(blob);
          flashSuccess(resultMessage("Голос", res));
        } catch (err) {
          flashError(err);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus("recording");
    } catch (err) {
      flashError(err);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
  }

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStatus("sending");
    setMessage(null);
    try {
      const res = await dumpPhotoRaw(file);
      flashSuccess(resultMessage("Фото", res));
    } catch (err) {
      flashError(err);
    }
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type.startsWith("image/")) {
      await handlePhotoBlob(file);
    } else {
      flashError(new Error("Пока поддерживаются только изображения"));
    }
  }

  async function handlePhotoBlob(blob: Blob) {
    setStatus("sending");
    setMessage(null);
    try {
      const res = await dumpPhotoRaw(blob);
      flashSuccess(resultMessage("Файл", res));
    } catch (err) {
      flashError(err);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void sendText();
    }
  }

  const busy = status === "sending";
  const recording = status === "recording";

  return (
    <>
      <button
        type="button"
        className={`ai-sheet__backdrop ${open ? "show" : ""}`}
        aria-label="Закрыть"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <section
        className={`ai-sheet ${open ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="AI-ввод"
        aria-hidden={!open}
      >
        <div className="ai-sheet__handle" aria-hidden="true" />

        <header className="ai-sheet__head">
          <div>
            <div className="ai-sheet__title">Что у тебя на уме?</div>
            <div className="ai-sheet__sub">
              Запиши, скажи голосом или прикрепи чек/фото — AI разберёт.
            </div>
          </div>
          <button
            type="button"
            className="ai-sheet__close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <Icon
              name="chevron-down"
              size={18}
              color="#0B1F3E"
              strokeWidth={2.4}
            />
          </button>
        </header>

        <textarea
          ref={textareaRef}
          className="ai-sheet__textarea"
          placeholder="Например: завтра в 10 встреча с Петей, не забыть купить молоко…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          rows={5}
          disabled={busy || recording}
        />

        {message ? (
          <div
            className={`ai-sheet__toast ai-sheet__toast--${status}`}
            role="status"
          >
            {message}
          </div>
        ) : null}

        <div className="ai-sheet__actions">
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={handlePhoto}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFile}
          />

          <button
            type="button"
            className="ai-sheet__action"
            onClick={() => photoRef.current?.click()}
            disabled={busy || recording}
          >
            <Icon name="sparkle" size={18} color="#2E5BFF" strokeWidth={2.2} />
            <span>Фото</span>
          </button>

          <button
            type="button"
            className="ai-sheet__action"
            onClick={() => fileRef.current?.click()}
            disabled={busy || recording}
          >
            <Icon
              name="paperclip"
              size={18}
              color="#2E5BFF"
              strokeWidth={2.2}
            />
            <span>Файл</span>
          </button>

          <button
            type="button"
            className={`ai-sheet__action ${recording ? "rec" : ""}`}
            onClick={recording ? stopRecording : startRecording}
            disabled={busy}
          >
            <Icon
              name="mic"
              size={18}
              color={recording ? "#fff" : "#2E5BFF"}
              strokeWidth={2.2}
            />
            <span>{recording ? "Стоп" : "Голос"}</span>
          </button>
        </div>

        <button
          type="button"
          className="ai-sheet__submit"
          onClick={() => void sendText()}
          disabled={busy || recording || !text.trim()}
        >
          {busy ? "Отправляю…" : "Отправить"}
        </button>
      </section>
    </>
  );
}
