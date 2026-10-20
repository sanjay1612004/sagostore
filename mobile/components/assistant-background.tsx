import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { usePreferences } from "../store/preferences";

export function AssistantBackground() {
  const dark = usePreferences((s) => s.theme) === "dark";
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 1440 1000"
        preserveAspectRatio="none"
      >
        <Defs>
          <RadialGradient
            id="assistantBlueGlow"
            cx="50%"
            cy="46%"
            rx="56%"
            ry="62%"
          >
            <Stop
              offset="0"
              stopColor={dark ? "#203D91" : "#D9E5FF"}
              stopOpacity={dark ? 0.7 : 0.8}
            />
            <Stop
              offset="0.48"
              stopColor={dark ? "#15234D" : "#E9EEFF"}
              stopOpacity={dark ? 0.6 : 0.6}
            />
            <Stop
              offset="1"
              stopColor={dark ? "#101114" : "#F5F5FC"}
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>
        <Rect width="1440" height="1000" fill="url(#assistantBlueGlow)" />
      </Svg>
    </View>
  );
}
