import { Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function DumpButton() {
  const router = useRouter();
  return (
    <Pressable style={styles.fab} onPress={() => router.push("/(app)/dump")}>
      <Text style={styles.icon}>🎤</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#4F8EF7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4F8EF7",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: { fontSize: 24 },
});
