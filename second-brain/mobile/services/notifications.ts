import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { Task } from "../store/useAppStore";
import { i18n } from "./i18n";

const tr = (key: string, opts?: Record<string, unknown>) =>
  i18n.isInitialized ? i18n.t(key, opts) : key;

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function scheduleReminder(task: Task): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!task.reminder_at) return null;
  const date = new Date(task.reminder_at);
  if (date <= new Date()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: task.title,
      body: tr("notifications.task_reminder_body"),
      data: { taskId: task.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

let _eveningId: string | undefined;
let _morningId: string | undefined;
let _reflectionId: string | undefined;

export async function scheduleEveningReflection(time: string): Promise<void> {
  if (Platform.OS === "web") return;
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  if (isNaN(hour) || isNaN(minute)) return;

  await cancelEveningReflection();

  _reflectionId = await Notifications.scheduleNotificationAsync({
    content: {
      title: tr("notifications.evening_reflection_title"),
      body: tr("notifications.evening_reflection_body"),
      data: { screen: "/(app)/reflection/today" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelEveningReflection(): Promise<void> {
  if (Platform.OS === "web") return;
  if (_reflectionId) {
    await Notifications.cancelScheduledNotificationAsync(_reflectionId).catch(
      () => {},
    );
    _reflectionId = undefined;
  }
}

export async function scheduleEveningReminder(name: string): Promise<void> {
  if (Platform.OS === "web") return;
  if (_eveningId)
    await Notifications.cancelScheduledNotificationAsync(_eveningId).catch(
      () => {},
    );
  if (_morningId)
    await Notifications.cancelScheduledNotificationAsync(_morningId).catch(
      () => {},
    );

  _eveningId = await Notifications.scheduleNotificationAsync({
    content: {
      title: tr("notifications.evening_reminder_title", { name }),
      body: tr("notifications.evening_reminder_body"),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
  _morningId = await Notifications.scheduleNotificationAsync({
    content: {
      title: tr("notifications.morning_reminder_title", { name }),
      body: tr("notifications.morning_reminder_body"),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });
}
