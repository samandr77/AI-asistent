import { Text } from "react-native";
import { Tabs } from "expo-router";

export default function AppLayout() {
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
        options={{ title: "Сегодня", tabBarIcon: () => <Text>🏠</Text> }}
      />
      <Tabs.Screen
        name="all"
        options={{ title: "Все", tabBarIcon: () => <Text>📋</Text> }}
      />
      <Tabs.Screen
        name="goals"
        options={{ title: "Цели", tabBarIcon: () => <Text>🎯</Text> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Профиль", tabBarIcon: () => <Text>👤</Text> }}
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
    </Tabs>
  );
}
