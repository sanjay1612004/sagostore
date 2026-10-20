import React, { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { Card, Row, T } from "./ui";
import { useTheme } from "../theme";

export function FormDetails({
  title = "More options",
  summary,
  open,
  onToggle,
  children,
}: {
  title?: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const c = useTheme();
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={onToggle}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Row>
          <View style={{ flex: 1, gap: 5 }}>
            <T weight="bold">{title}</T>
            <T size={12} color={c.muted}>
              {summary}
            </T>
          </View>
          {open ? (
            <ChevronUp color={c.muted} size={20} />
          ) : (
            <ChevronDown color={c.muted} size={20} />
          )}
        </Row>
      </Pressable>
      {open && <View style={{ gap: 16, paddingTop: 12 }}>{children}</View>}
    </Card>
  );
}
