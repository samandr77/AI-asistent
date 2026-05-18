import Purchases from "react-native-purchases";
import {
  initRevenueCat,
  logInToRevenueCat,
  isPremium,
  getPremiumStatus,
  buyPremium,
  restorePurchases,
  logOutRevenueCat,
  addPremiumListener,
} from "../services/purchases";

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("initRevenueCat", () => {
  it("calls configure with the ios key", async () => {
    await initRevenueCat("user-123");
    expect(mockPurchases.configure).toHaveBeenCalledWith({
      apiKey: "appl_test_key",
    });
    expect(mockPurchases.logIn).toHaveBeenCalledWith("user-123");
  });

  it("calls configure without logIn when no userId", async () => {
    await initRevenueCat();
    expect(mockPurchases.configure).toHaveBeenCalled();
    expect(mockPurchases.logIn).not.toHaveBeenCalled();
  });
});

describe("logInToRevenueCat", () => {
  it("calls logIn with userId", async () => {
    await logInToRevenueCat("user-abc");
    expect(mockPurchases.logIn).toHaveBeenCalledWith("user-abc");
  });
});

describe("logOutRevenueCat", () => {
  it("calls logOut", async () => {
    await logOutRevenueCat();
    expect(mockPurchases.logOut).toHaveBeenCalled();
  });
});

describe("isPremium", () => {
  it("returns false when no active entitlement", async () => {
    mockPurchases.getCustomerInfo.mockResolvedValueOnce({
      entitlements: { active: {} },
    } as any);
    expect(await isPremium()).toBe(false);
  });

  it("returns true when premium entitlement active", async () => {
    mockPurchases.getCustomerInfo.mockResolvedValueOnce({
      entitlements: { active: { premium: { isActive: true } } },
    } as any);
    expect(await isPremium()).toBe(true);
  });
});

describe("getPremiumStatus", () => {
  it("returns free defaults when no entitlement", async () => {
    mockPurchases.getCustomerInfo.mockResolvedValueOnce({
      entitlements: { active: {} },
    } as any);
    const status = await getPremiumStatus();
    expect(status.is_premium).toBe(false);
    expect(status.entitlement_id).toBeNull();
  });

  it("returns premium status when entitlement active", async () => {
    mockPurchases.getCustomerInfo.mockResolvedValueOnce({
      entitlements: {
        active: {
          premium: {
            isActive: true,
            expirationDate: "2026-12-31T00:00:00Z",
            periodType: "NORMAL",
            store: "APP_STORE",
          },
        },
      },
    } as any);
    const status = await getPremiumStatus();
    expect(status.is_premium).toBe(true);
    expect(status.entitlement_id).toBe("premium");
    expect(status.expires_at).toBe("2026-12-31T00:00:00Z");
    expect(status.period_type).toBe("NORMAL");
    expect(status.store).toBe("APP_STORE");
  });
});

describe("buyPremium", () => {
  it("returns true when purchase succeeds and premium is active", async () => {
    mockPurchases.getOfferings.mockResolvedValueOnce({
      current: { monthly: { identifier: "monthly" } },
    } as any);
    mockPurchases.purchasePackage.mockResolvedValueOnce({
      customerInfo: {
        entitlements: { active: { premium: { isActive: true } } },
      },
    } as any);
    expect(await buyPremium()).toBe(true);
  });

  it("returns false when purchase cancelled", async () => {
    mockPurchases.getOfferings.mockResolvedValueOnce({
      current: { monthly: { identifier: "monthly" } },
    } as any);
    mockPurchases.purchasePackage.mockRejectedValueOnce({
      code: 1,
    });
    expect(await buyPremium()).toBe(false);
  });

  it("returns false when no current offering", async () => {
    mockPurchases.getOfferings.mockResolvedValueOnce({
      current: null,
    } as any);
    expect(await buyPremium()).toBe(false);
  });
});

describe("restorePurchases", () => {
  it("returns true when premium entitlement found", async () => {
    mockPurchases.restorePurchases.mockResolvedValueOnce({
      entitlements: { active: { premium: { isActive: true } } },
    } as any);
    expect(await restorePurchases()).toBe(true);
  });

  it("returns false when no entitlement found", async () => {
    mockPurchases.restorePurchases.mockResolvedValueOnce({
      entitlements: { active: {} },
    } as any);
    expect(await restorePurchases()).toBe(false);
  });
});

describe("addPremiumListener", () => {
  it("registers listener and returns unsubscribe fn", () => {
    const callback = jest.fn();
    const unsub = addPremiumListener(callback);
    expect(mockPurchases.addCustomerInfoUpdateListener).toHaveBeenCalled();
    expect(typeof unsub).toBe("function");
  });
});
