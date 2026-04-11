import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Task } from "../store/useAppStore";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPushPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getExpoPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function scheduleReminder(task: Task): Promise<string | null> {
  if (!task.reminder_at) return null;
  const date = new Date(task.reminder_at);
  if (date <= new Date()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: task.title,
      body: "Напоминание о задаче",
      data: { taskId: task.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

export async function scheduleEveningReminder(name: string): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${name}, как прошёл день? 🌙`,
      body: "Пора разгрузиться перед сном.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Доброе утро, ${name} ☀️`,
      body: "Что у нас на сегодня?",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });
}
