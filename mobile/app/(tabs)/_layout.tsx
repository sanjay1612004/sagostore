import React from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { Home, ArrowLeftRight, Mic, Users, Grid2X2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { selectionFeedback } from "../../services/haptics";
import { T } from "../../components/ui";
import { useTheme } from "../../theme";
const icons = [Home, ArrowLeftRight, Mic, Users, Grid2X2];
function BottomBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const c = useTheme(),
    insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const names = ["Home", "Activity", "Voice", "Customers", "More"];
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingTop: 6,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingHorizontal: width > 1160 ? (width - 1100) / 2 : 8,
        shadowColor: c.shadow,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
      }}
    >
      {state.routes.map((route, i) => {
        const Icon = icons[i]!;
        const active = state.index === i;
        const voice = i === 2;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={names[i]}
            accessibilityState={{ selected: active }}
            onPress={() => {
              const e = emitter.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!e.defaultPrevented) {
                void selectionFeedback();
                navigateToTab(route.key);
              }
            }}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 4,
              minHeight: 56,
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 48,
                height: 35,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: voice
                  ? c.accent
                  : active
                    ? c.soft
                    : "transparent",
              }}
            >
              <Icon
                size={21}
                color={voice ? c.accentText : active ? c.accent : c.muted}
              />
            </View>
            <T
              size={width < 400 ? 10 : 11}
              color={active ? c.accent : c.muted}
              weight={active ? "bold" : "medium"}
            >
              {names[i]}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="voice" />
      <Tabs.Screen name="customers" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
