const PURCHASES_ERROR_CODE = {
  PURCHASE_CANCELLED_ERROR: 1,
};

const LOG_LEVEL = {
  VERBOSE: "VERBOSE",
};

const Purchases = {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  configure: jest.fn(),
  setLogLevel: jest.fn(),
  logIn: jest
    .fn()
    .mockResolvedValue({ customerInfo: { entitlements: { active: {} } } }),
  logOut: jest.fn().mockResolvedValue({}),
  getCustomerInfo: jest
    .fn()
    .mockResolvedValue({ entitlements: { active: {} } }),
  getOfferings: jest
    .fn()
    .mockResolvedValue({ current: { monthly: { identifier: "monthly" } } }),
  purchasePackage: jest
    .fn()
    .mockResolvedValue({ customerInfo: { entitlements: { active: {} } } }),
  restorePurchases: jest
    .fn()
    .mockResolvedValue({ entitlements: { active: {} } }),
  addCustomerInfoUpdateListener: jest.fn().mockReturnValue(() => {}),
};

export default Purchases;
