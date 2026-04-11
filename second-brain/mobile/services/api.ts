import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { Task } from "../store/useAppStore";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
);

const api = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_URL });

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export interface DumpTextResponse {
  dump_id: string;
  tasks: Task[];
  today_top3: Task[];
  task_ids: string[];
}

export interface DumpVoiceResponse extends DumpTextResponse {
  transcription: string;
}

export async function dumpText(
  text: string,
  userContext: object = {},
): Promise<DumpTextResponse> {
  const { data } = await api.post("/dump/text", {
    text,
    user_context: userContext,
  });
  return data;
}

export async function dumpVoice(uri: string): Promise<DumpVoiceResponse> {
  const formData = new FormData();
  formData.append("file", { uri, name: "audio.m4a", type: "audio/m4a" } as any);
  const { data } = await api.post("/dump/voice", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getTodayTasks(): Promise<Task[]> {
  const { data } = await api.get("/tasks/today");
  return data;
}

export async function getAllTasks(sphere?: string): Promise<Task[]> {
  const { data } = await api.get("/tasks/", {
    params: sphere ? { sphere } : {},
  });
  return data;
}

export async function updateTask(
  id: string,
  updates: Partial<Task>,
): Promise<Task> {
  const { data } = await api.patch(`/tasks/${id}`, updates);
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}
