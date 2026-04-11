import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

export function initRevenueCat(userId?: string) {
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY!
      : process.env.EXPO_PUBLIC_RC_ANDROID_KEY!;
  Purchases.configure({ apiKey });
  if (userId) Purchases.logIn(userId);
}

export async function isPremium(): Promise<boolean> {
  const info = await Purchases.getCustomerInfo();
  return typeof info.entitlements.active["premium"] !== "undefined";
}

export async function buyPremium(): Promise<boolean> {
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.monthly;
  if (!pkg) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return typeof customerInfo.entitlements.active["premium"] !== "undefined";
  } catch (e: unknown) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  return typeof info.entitlements.active["premium"] !== "undefined";
}
