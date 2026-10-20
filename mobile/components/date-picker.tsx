import React, { useState } from "react";
import { Platform, View, Text, Pressable } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { selectionFeedback } from "../services/haptics";
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
  const [show, setShow] = useState(false);
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          void selectionFeedback();
          setShow(!show);
        }}
        style={({ pressed }) => ({
          minHeight: 52,
          borderRadius: 16,
          paddingVertical: 14,
          paddingHorizontal: 18,
          backgroundColor: c.elevated,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text
          style={{
            fontFamily: "InterBold",
            fontSize: 14,
            color: c.text,
            lineHeight: 21,
          }}
        >
          {value || "Choose date"}
        </Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={value ? new Date(value + "T12:00:00") : new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(_event, date) => {
            if (Platform.OS !== "ios") setShow(false);
            if (date)
              onChange(
                `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
              );
          }}
        />
      )}
    </View>
  );
}
