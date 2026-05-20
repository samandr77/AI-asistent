import { storage } from "./storage";

const onboardingCompleteKey = "telegram-miniapp:onboarding-v1-complete";

export function isOnboardingComplete(): boolean {
  return storage.getString(onboardingCompleteKey) === "1";
}

export function markOnboardingComplete(): void {
  storage.setString(onboardingCompleteKey, "1");
}
