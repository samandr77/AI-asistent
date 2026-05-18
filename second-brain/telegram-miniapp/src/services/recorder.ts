export interface RecorderSession {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

export function isVoiceRecordingSupported(): boolean {
  return Boolean(
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof window.MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("audio/webm"),
  );
}

export async function startVoiceRecording(): Promise<RecorderSession> {
  if (!isVoiceRecordingSupported()) {
    throw new Error("Voice recording is not supported");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };
  recorder.start();

  function stopTracks() {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }

  return {
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.onerror = () => {
          stopTracks();
          reject(new Error("Recording failed"));
        };
        recorder.onstop = () => {
          stopTracks();
          resolve(new Blob(chunks, { type: "audio/webm" }));
        };
        recorder.stop();
      }),
    cancel: () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
      stopTracks();
    },
  };
}
