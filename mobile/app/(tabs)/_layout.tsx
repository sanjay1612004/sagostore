import React from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { Home, ArrowLeftRight, Mic, Users, Grid2X2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { selectionFeedback } from "../../services/haptics";
import { T } from "../../components/ui";
import { useTheme } from "../../theme";
import { LinearGradient } from "expo-linear-gradient";
import { usePreferences } from "../../store/preferences";
const icons = [Home, ArrowLeftRight, Mic, Users, Grid2X2];
function BottomBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const c = useTheme(),
    insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dark = usePreferences((preferences) => preferences.theme === "dark");
  const names = ["Home", "Activity", "Voice", "Customers", "More"];
  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingBottom: Math.max(insets.bottom, 6),
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 920,
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "flex-end",
          paddingHorizontal: width < 360 ? 0 : 4,
          paddingBottom: 7,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 22,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: dark ? "#142B29" : "#F6FFFC",
            borderTopWidth: 1,
            borderColor: dark ? "#34554C" : "#FFFFFF",
            borderRadius: 0,
          }}
        >
          <LinearGradient
            colors={
              dark
                ? ["#203B35", "#152624", "#19252F"]
                : ["#E1FFF5", "#FFFFFF", "#EAF1FA"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </View>
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
              aria-selected={active}
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
              style={({ pressed }) => ({
                flex: voice && width < 400 ? 1.35 : 1,
                minWidth: 0,
                zIndex: voice ? 2 : 1,
                alignItems: "center",
                gap: 2,
                height: voice ? 88 : 54,
                justifyContent: "flex-end",
                opacity: pressed ? 0.72 : 1,
              })}
            >
              {voice ? (
                <LinearGradient
                  colors={
                    dark
                      ? ["#A5FFE2", "#255E4D", "#50E3B5"]
                      : ["#FFFFFF", "#BEFFEB", "#68EEC9"]
                  }
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={{
                    width: 72,
                    height: 72,
                    padding: 4,
                    borderRadius: 36,
                    borderWidth: 1,
                    borderColor: active
                      ? dark
                        ? "#90FFDD"
                        : "#64EBC8"
                      : dark
                        ? "#3E806B"
                        : "#DDFFF4",
                    shadowColor: "#00D9A5",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: active ? 0.42 : 0.26,
                    shadowRadius: active ? 18 : 12,
                    elevation: 6,
                  }}
                >
                  <LinearGradient
                    colors={
                      dark
                        ? ["#11DCA7", "#008A6E", "#005C4E"]
                        : ["#00DBAA", "#009E7B", "#006453"]
                    }
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 31,
                      borderWidth: 1,
                      borderColor: "#3AF3C4",
                    }}
                  >
                    <Mic size={29} strokeWidth={2} color="#FFFFFF" />
                  </LinearGradient>
                </LinearGradient>
              ) : (
                <View
                  style={{
                    width: 42,
                    height: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 14,
                    backgroundColor: active
                      ? dark
                        ? "#164B3C"
                        : "#CFFFF0"
                      : "transparent",
                    borderWidth: 1,
                    borderColor: active
                      ? dark
                        ? "#388369"
                        : "#9EF4DA"
                      : "transparent",
                  }}
                >
                  <Icon
                    size={22}
                    color={active ? c.accent : c.muted}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                </View>
              )}
              <T
                size={voice ? 11 : width < 400 ? 10 : 11}
                color={active || voice ? c.accent : c.muted}
                weight={active || voice ? "bold" : "medium"}
                style={{ lineHeight: 14 }}
              >
                {names[i]}
              </T>
              {active && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    bottom: -5,
                    width: 16,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: c.accent,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </View>
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
