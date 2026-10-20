import React, { useEffect } from "react";
import { View, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
  useReducedMotion,
} from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import { Mic, Square } from "lucide-react-native";
import { useTheme } from "../theme";

export function VoiceMicrophoneButton({
  recording,
  busy,
  disabled = false,
  onPress,
  levels,
  compact = false,
}: {
  recording: boolean;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
  levels: number[];
  compact?: boolean;
}) {
  const c = useTheme(),
    reduced = useReducedMotion(),
    scale = useSharedValue(1);
  const size = compact ? 88 : 144;
  useEffect(() => {
    if (recording && !reduced)
      scale.value = withRepeat(withTiming(1.04, { duration: 1000 }), -1, true);
    else {
      cancelAnimation(scale);
      scale.value = withTiming(1);
    }
    return () => cancelAnimation(scale);
  }, [recording, reduced, scale]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            recording ? "Stop recording and upload" : "Record Tamil command"
          }
          accessibilityState={{ disabled: busy || disabled, busy }}
          disabled={busy || disabled}
          onPress={onPress}
          style={({ pressed }) => ({
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: recording
              ? c.accent
              : pressed
                ? c.elevated
                : c.soft,
            borderWidth: 1,
            borderColor: recording ? c.accent : `${c.accent}40`,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy || disabled ? 0.5 : pressed ? 0.75 : 1,
          })}
        >
          {recording ? (
            <Square
              size={compact ? 20 : 31}
              color={c.accentText}
              fill={c.accentText}
            />
          ) : (
            <Mic
              size={compact ? 27 : 39}
              color={c.accent}
              strokeWidth={1.7}
            />
          )}
        </Pressable>
      </Animated.View>
      {(!compact || recording) && (
        <Svg
          width={compact ? 180 : 220}
          height={compact ? 24 : 40}
          viewBox="0 0 220 40"
          accessibilityLabel={
            recording ? "Live microphone levels" : "Microphone ready"
          }
        >
          {Array.from({ length: 31 }, (_, i) => {
            const amplitude = recording
              ? (levels[levels.length - 31 + i] ?? 0)
              : 0;
            const height = 3 + Math.min(34, amplitude * 34);
            return (
              <Line
                key={i}
                x1={i * 7 + 5}
                x2={i * 7 + 5}
                y1={20 - height / 2}
                y2={20 + height / 2}
                stroke={c.accent}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={recording ? 1 : 0.25}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}
