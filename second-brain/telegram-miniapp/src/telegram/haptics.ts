import { getTelegramWebApp } from "./sdk";

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotificationType = "error" | "success" | "warning";

export function impact(style: ImpactStyle = "light"): void {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred(style);
}

export function notify(type: NotificationType): void {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred(type);
}

export function selectionChanged(): void {
  getTelegramWebApp()?.HapticFeedback?.selectionChanged();
}
