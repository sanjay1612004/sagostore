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
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Stop,
  Line,
} from "react-native-svg";
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
  const size = compact ? 136 : 260;
  const ratio = size / 260;
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
        <Svg width={size} height={size} viewBox="0 0 260 260">
          <Defs>
            <RadialGradient id="voiceBlueHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c.accent} stopOpacity={0.15} />
              <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="voiceBlueOrb" cx="32%" cy="24%" r="85%">
              <Stop offset="0" stopColor={c.accent} />
              <Stop offset="1" stopColor={c.accent} />
            </RadialGradient>
          </Defs>
          <Circle cx={130} cy={130} r={126} fill="url(#voiceBlueHalo)" />
          {[100].map((r, i) => (
            <Circle
              key={r}
              cx={130}
              cy={130}
              r={r}
              fill="none"
              stroke={c.accent}
              strokeOpacity={recording ? 0.2 + i * 0.07 : 0.12}
            />
          ))}
          <Circle
            cx={130}
            cy={130}
            r={65}
            fill="url(#voiceBlueOrb)"
            stroke={c.accent}
            strokeOpacity={0.2}
          />
        </Svg>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            recording ? "Stop recording and upload" : "Record Tamil command"
          }
          accessibilityState={{ disabled: busy || disabled, busy }}
          disabled={busy || disabled}
          onPress={onPress}
          style={({ pressed }) => ({
            position: "absolute",
            top: 64 * ratio,
            left: 64 * ratio,
            width: 132 * ratio,
            height: 132 * ratio,
            borderRadius: 66 * ratio,
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
              color={c.accentText}
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
