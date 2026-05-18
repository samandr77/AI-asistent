import { Pressable, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Sphere, SPHERE_MAP } from "../constants/spheres";

interface Props {
  sphere: Sphere | "all";
  count?: number;
  isActive: boolean;
  onPress: () => void;
}

export default function SphereTab({ sphere, count, isActive, onPress }: Props) {
  const { t } = useTranslation();
  const info =
    sphere === "all"
      ? { icon: "📋", labelKey: "spheres.all", color: "#6b7280" }
      : (SPHERE_MAP[sphere] ?? {
          icon: "?",
          labelKey: `spheres.${sphere}`,
          color: "#999",
        });
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tab,
        isActive && { borderBottomColor: info.color, borderBottomWidth: 2 },
      ]}
    >
      <Text style={styles.icon}>{info.icon}</Text>
      <Text style={[styles.label, isActive && { color: "#fff" }]}>
        {t(info.labelKey)}
      </Text>
      {count !== undefined && <Text style={styles.count}>{count}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  icon: { fontSize: 16 },
  label: { color: "#888", fontSize: 12, marginTop: 2 },
  count: { color: "#4F8EF7", fontSize: 11, marginTop: 1 },
});
