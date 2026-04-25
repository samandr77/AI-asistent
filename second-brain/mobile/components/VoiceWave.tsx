import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";

interface Props {
  isRecording: boolean;
}

export default function VoiceWave({ isRecording }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isRecording) {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.4,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
      animRef.current = null;
      scale.setValue(1);
    }
    return () => {
      animRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  return (
    <View style={styles.container}>
      {[1.6, 1.3, 1].map((s, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              transform: [{ scale: Animated.multiply(scale, s) }],
              opacity: isRecording ? 0.2 / s : 0,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4F8EF7",
  },
});
