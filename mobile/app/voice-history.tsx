import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Screen,
  T,
  Card,
  Button,
  LoadingSkeleton,
  EmptyState,
  ErrorNotice,
} from "../components/ui";
import { api } from "../services/api";
import { useTheme } from "../theme";
export default function VoiceHistory() {
  const c = useTheme();
  const q = useQuery({
    queryKey: ["voice-history"],
    queryFn: () =>
      api<{ text: string; intent: string; at: string }[]>("/api/voice/history"),
  });
  const [error, setError] = useState<unknown>();
  return (
    <Screen
      title="Conversation history"
      subtitle="Your recent commands. Context expires after 30 minutes of inactivity."
      back
    >
      <ErrorNotice error={q.error ?? error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <LoadingSkeleton />
      ) : q.data?.length ? (
        q.data.map((m, i) => (
          <Card key={i}>
            <T>{m.text}</T>
            <T color={c.muted} size={11}>
              {m.intent.replaceAll("_", " ")} ·{" "}
              {new Date(m.at).toLocaleTimeString()}
            </T>
          </Card>
        ))
      ) : (
        <EmptyState
          title="A new conversation"
          description="Your typed and spoken commands will appear here."
        />
      )}
      <Button
        title="Clear conversation context"
        variant="secondary"
        onPress={() => {
          void api("/api/voice/context", { method: "DELETE" })
            .then(() => q.refetch())
            .catch(setError);
        }}
      />
    </Screen>
  );
}
