import React, { useState } from "react";
import { Pressable } from "react-native";
import { Moon, Sun } from "lucide-react-native";
import { usePreferences } from "../store/preferences";
import { useTheme } from "../theme";

export function ThemeToggle({
  onError,
}: {
  onError: (error: unknown) => void;
}) {
  const c = useTheme();
  const theme = usePreferences((state) => state.theme);
  const [saving, setSaving] = useState(false);
  const nextTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${nextTheme} theme`}
      accessibilityHint={`Current theme is ${theme}. Saves your appearance preference.`}
      accessibilityState={{ disabled: saving }}
      disabled={saving}
      onPress={async () => {
        setSaving(true);
        onError(undefined);
        try {
          await usePreferences.getState().set({ theme: nextTheme });
        } catch (error) {
          onError(error);
        } finally {
          setSaving(false);
        }
      }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: pressed ? c.soft : c.surface,
        alignItems: "center",
        justifyContent: "center",
        opacity: saving ? 0.6 : 1,
      })}
    >
      <Icon size={19} color={c.text} />
    </Pressable>
  );
}
