import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../theme";
export function ModernDatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: 12,
          color: c.muted,
          lineHeight: 18,
        }}
      >
        {label}
      </Text>
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          boxSizing: "border-box",
          width: "100%",
          minHeight: 52,
          padding: 14,
          borderRadius: 14,
          border: `1px solid ${c.border}`,
          background: c.elevated,
          color: c.text,
          fontFamily: "Inter, sans-serif",
          fontSize: 15,
          colorScheme: c.bg === "#080D13" ? "dark" : "light",
        }}
      />
    </View>
  );
}
