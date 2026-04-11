import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import { supabase } from "../services/api";
import { initRevenueCat } from "../services/purchases";
import { useAppStore } from "../store/useAppStore";
import { getTodayTasks, getAllTasks } from "../services/api";

export default function RootLayout() {
  const { isOnboarded, user, setUser, setTodayTasks, setAllTasks } =
    useAppStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initRevenueCat(user?.id);
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser({
          id: session.user.id,
          ...session.user.user_metadata,
        } as Parameters<typeof setUser>[0]);
        const [today, all] = await Promise.all([
          getTodayTasks(),
          getAllTasks(),
        ]);
        setTodayTasks(today);
        setAllTasks(all);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setTodayTasks([]);
        setAllTasks([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const inOnboarding = segments[0] === "(onboarding)";
    if (!user && !inOnboarding) {
      router.replace("/(onboarding)/welcome");
    } else if (user && !isOnboarded && !inOnboarding) {
      router.replace("/(onboarding)/first-dump");
    } else if (user && isOnboarded && inOnboarding) {
      router.replace("/(app)/");
    }
  }, [user, isOnboarded, segments]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const taskId = response.notification.request.content.data?.taskId as
          | string
          | undefined;
        if (taskId) router.push(`/(app)/task/${taskId}`);
      },
    );
    return () => sub.remove();
  }, []);

  return <Slot />;
}
