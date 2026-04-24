import { Platform } from "react-native";
import type { PremiumStatus } from "../store/useAppStore";

function getPurchasesModule(): any | null {
  if (Platform.OS === "web") {
    return null;
  }

  const module = require("react-native-purchases");
  return module.default ?? module;
}

function _isPremiumFromInfo(info: any): boolean {
  return typeof info?.entitlements?.active?.["premium"] !== "undefined";
}

function _premiumStatusFromInfo(info: any): PremiumStatus {
  const entitlement = info?.entitlements?.active?.["premium"];
  return {
    is_premium: !!entitlement,
    entitlement_id: entitlement ? "premium" : null,
    expires_at: entitlement?.expirationDate ?? null,
    period_type: entitlement?.periodType ?? null,
    store: entitlement?.store ?? null,
    cancelled: entitlement ? !entitlement.isActive : false,
  };
}

export async function initRevenueCat(userId?: string) {
  const Purchases = getPurchasesModule();
  if (!Purchases) {
    return;
  }

  if (__DEV__) Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE);
  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY!
      : process.env.EXPO_PUBLIC_RC_ANDROID_KEY!;
  if (!apiKey) {
    return;
  }
  Purchases.configure({ apiKey });
  if (userId) {
    await Purchases.logIn(userId).catch(() => {});
  }
}

export async function logInToRevenueCat(userId: string) {
  const Purchases = getPurchasesModule();
  if (!Purchases) {
    return;
  }

  await Purchases.logIn(userId).catch(() => {});
}

export async function isPremium(): Promise<boolean> {
  const Purchases = getPurchasesModule();
  if (!Purchases) {
    return false;
  }
  const info = await Purchases.getCustomerInfo();
  return _isPremiumFromInfo(info);
}

export async function getPremiumStatus(): Promise<PremiumStatus> {
  const Purchases = getPurchasesModule();
  if (!Purchases) {
    return {
      is_premium: false,
      entitlement_id: null,
      expires_at: null,
      period_type: null,
      store: null,
      cancelled: false,
    };
  }
  const info = await Purchases.getCustomerInfo();
  return _premiumStatusFromInfo(info);
}

export function addPremiumListener(
  callback: (status: PremiumStatus) => void,
): () => void {
  const Purchases = getPurchasesModule();
  if (!Purchases) return () => {};
  const remove = Purchases.addCustomerInfoUpdateListener((info: any) => {
    callback(_premiumStatusFromInfo(info));
  });
  return typeof remove === "function" ? remove : () => {};
}

export async function buyPremium(): Promise<boolean> {
  const Purchases = getPurchasesModule();
  if (!Purchases) {
    return false;
  }
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.monthly;
  if (!pkg) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return _isPremiumFromInfo(customerInfo);
  } catch (e: unknown) {
    if (
      (e as { code?: number }).code ===
      (Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR as number)
    )
      return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const Purchases = getPurchasesModule();
  if (!Purchases) {
    return false;
  }
  const info = await Purchases.restorePurchases();
  return _isPremiumFromInfo(info);
}

export async function logOutRevenueCat(): Promise<void> {
  const Purchases = getPurchasesModule();
  if (!Purchases) return;
  await Purchases.logOut().catch(() => {});
}
