import React from "react";
import { Pressable } from "react-native";
import { Mic } from "lucide-react-native";
import { router } from "expo-router";
import type { VoiceCatalogAction } from "@tamiltrade/shared";
import { newKey } from "../services/api";
import { selectionFeedback } from "../services/haptics";
import { useTheme } from "../theme";

export function AddByVoice({ kind }: { kind: VoiceCatalogAction["kind"] }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${kind} by voice`}
      onPress={() => {
        void selectionFeedback();
        router.push({
          pathname: "/(tabs)/voice",
          params: { create: kind, request: newKey() },
        });
      }}
      style={({ pressed }) => ({
        width: 52,
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 13,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: pressed ? c.soft : c.surface,
      })}
    >
      <Mic size={21} color={c.accent} />
    </Pressable>
  );
}
