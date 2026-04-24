// Set EXPO_PUBLIC_* env vars before babel transforms read them.
// In jest-expo, EXPO_PUBLIC_* vars are inlined at transform time,
// so we define them here before any module is loaded.
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "test-web-client-id";
process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = "test-ios-client-id";
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.EXPO_PUBLIC_RC_IOS_KEY = "appl_test_key";
process.env.EXPO_PUBLIC_RC_ANDROID_KEY = "goog_test_key";
