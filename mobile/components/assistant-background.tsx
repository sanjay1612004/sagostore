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
              stopColor={dark ? "#164B3C" : "#D1EFE0"}
              stopOpacity={0.25}
            />
            <Stop
              offset="0.48"
              stopColor={dark ? "#113027" : "#E5F2EB"}
              stopOpacity={0.2}
            />
            <Stop
              offset="1"
              stopColor={dark ? "#0D1518" : "#F4F7F6"}
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>
        <Rect width="1440" height="1000" fill="url(#assistantBlueGlow)" />
      </Svg>
    </View>
  );
}
