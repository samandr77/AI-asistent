import { useEffect, useState } from "react";
import {
  Slot,
  useNavigationContainerRef,
  useRouter,
  useSegments,
} from "expo-router";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getAllTasks, getMe, getTodayTasks, supabase } from "../services/api";
import {
  initRevenueCat,
  logInToRevenueCat,
  logOutRevenueCat,
  addPremiumListener,
  getPremiumStatus,
} from "../services/purchases";
import { scheduleEveningReflection } from "../services/notifications";
import { useAppStore } from "../store/useAppStore";
import { isGoogleSignInConfigured } from "../services/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Sentry, initSentry, navigationIntegration } from "../services/sentry";
import { startQueueListener, drainQueue } from "../services/dumpQueue";

initSentry();

function RootLayout() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const navRef = useNavigationContainerRef();
  useEffect(() => {
    if (navRef) {
      navigationIntegration.registerNavigationContainer(navRef);
    }
  }, [navRef]);
  const {
    isOnboarded,
    user,
    setUser,
    setTodayTasks,
    setAllTasks,
    setOnboarded,
    reflectionReminderTime,
    setPremium,
  } = useAppStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    void initRevenueCat();
    const removePremiumListener = addPremiumListener(setPremium);
    return removePremiumListener;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = startQueueListener();
    void drainQueue();
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isGoogleSignInConfigured()) return;
    try {
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        ...(Platform.OS === "ios" &&
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
          ? { iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID }
          : {}),
      });
    } catch {
      // Native module not available (web or pre-build) — silently skip
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || !reflectionReminderTime) return;
    void scheduleEveningReflection(reflectionReminderTime);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let isActive = true;

    async function hydrateAuthenticatedUser(sessionUser: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    }) {
      try {
        const [{ profile }, today, all] = await Promise.all([
          getMe(),
          getTodayTasks(),
          getAllTasks(),
        ]);
        const syncedUser = {
          id: sessionUser.id,
          email: sessionUser.email,
          ...(sessionUser.user_metadata ?? {}),
          ...(profile ?? {}),
        };

        setUser(syncedUser as Parameters<typeof setUser>[0]);
        setOnboarded(Boolean(profile?.is_onboarded));
        setTodayTasks(today);
        setAllTasks(all);
        await logInToRevenueCat(sessionUser.id);
        const premiumStatus = await getPremiumStatus();
        setPremium(premiumStatus);
      } catch {
        setUser({
          id: sessionUser.id,
          email: sessionUser.email,
          ...(sessionUser.user_metadata ?? {}),
        } as Parameters<typeof setUser>[0]);
        setOnboarded(false);
        setTodayTasks([]);
        setAllTasks([]);
      } finally {
        if (isActive) {
          setIsBootstrapping(false);
        }
      }
    }

    function clearAuthenticatedUser() {
      void logOutRevenueCat();
      setUser(null);
      setOnboarded(false);
      setTodayTasks([]);
      setAllTasks([]);
      if (isActive) {
        setIsBootstrapping(false);
      }
    }

    async function bootstrapSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await hydrateAuthenticatedUser(session.user);
      } else {
        clearAuthenticatedUser();
      }
    }

    void bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        clearAuthenticatedUser();
        return;
      }

      if (session?.user) {
        await hydrateAuthenticatedUser(session.user);
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [setAllTasks, setOnboarded, setTodayTasks, setUser]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    const inOnboarding = segments[0] === "(onboarding)";
    const onboardingScreen = segments[segments.length - 1];

    if (!user) {
      if (!inOnboarding || onboardingScreen !== "welcome") {
        router.replace("/(onboarding)/welcome");
      }
      return;
    }

    if (!isOnboarded) {
      if (
        !inOnboarding ||
        (onboardingScreen !== "setup" && onboardingScreen !== "first-dump")
      ) {
        router.replace("/(onboarding)/setup");
      }
    } else if (inOnboarding) {
      router.replace("/(app)/");
    }
  }, [isBootstrapping, user, isOnboarded, segments, router]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    if (!user && !segments.length) {
      router.replace("/(onboarding)/welcome");
    }
  }, [isBootstrapping, user, segments, router]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const taskId = data?.taskId as string | undefined;
        const screen = data?.screen as string | undefined;
        if (taskId) {
          router.replace(`/(app)/task/${taskId}`);
        } else if (screen) {
          router.replace(screen as Parameters<typeof router.replace>[0]);
        }
      },
    );
    return () => sub.remove();
  }, [router]);

  if (isBootstrapping) {
    return null;
  }

  return <Slot />;
}

export default Sentry.wrap(RootLayout);
