import { Text } from "react-native";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

export default function AppLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#0A0A0A", borderTopColor: "#1A1A1A" },
        tabBarActiveTintColor: "#4F8EF7",
        tabBarInactiveTintColor: "#555",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("tabs.today"), tabBarIcon: () => <Text>🏠</Text> }}
      />
      <Tabs.Screen
        name="all"
        options={{ title: t("tabs.all"), tabBarIcon: () => <Text>📋</Text> }}
      />
      <Tabs.Screen
        name="goals"
        options={{ title: t("tabs.goals"), tabBarIcon: () => <Text>🎯</Text> }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: () => <Text>👤</Text>,
        }}
      />
      <Tabs.Screen name="dump" options={{ href: null }} />
      <Tabs.Screen name="result" options={{ href: null }} />
      <Tabs.Screen name="task/[id]" options={{ href: null }} />
      <Tabs.Screen name="goals/new" options={{ href: null }} />
      <Tabs.Screen name="goals/[id]" options={{ href: null }} />
      <Tabs.Screen name="reflection/index" options={{ href: null }} />
      <Tabs.Screen name="reflection/today" options={{ href: null }} />
      <Tabs.Screen name="reflection/[date]" options={{ href: null }} />
      <Tabs.Screen name="reflection/settings" options={{ href: null }} />
      <Tabs.Screen name="paywall" options={{ href: null }} />
    </Tabs>
  );
}
