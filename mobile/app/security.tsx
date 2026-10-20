import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Screen,
  T,
  Card,
  Button,
  ErrorNotice,
  LoadingSkeleton,
  EmptyState,
} from "../components/ui";
import { api } from "../services/api";
import { useTheme } from "../theme";
type Session = {
  _id: string;
  device: string;
  createdAt: string;
  expiresAt: string;
};
export default function Security() {
  const c = useTheme();
  const q = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api<Session[]>("/auth/sessions"),
  });
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState<string | null>(null);
  return (
    <Screen
      title="Security & sessions"
      subtitle="Review and revoke devices signed in to your account."
      back
    >
      <ErrorNotice error={q.error ?? error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <LoadingSkeleton />
      ) : q.data?.length ? (
        q.data.map((s) => (
          <Card key={s._id}>
            <T size={18} weight="bold">
              {s.device}
            </T>
            <T color={c.muted} size={12}>
              Signed in {new Date(s.createdAt).toLocaleString()}
            </T>
            <T color={c.muted} size={12}>
              Expires {new Date(s.expiresAt).toLocaleDateString()}
            </T>
            <Button
              title="Revoke session"
              variant="danger"
              busy={busy === s._id}
              onPress={() => {
                setBusy(s._id);
                void api(`/auth/sessions/${s._id}`, { method: "DELETE" })
                  .then(() => q.refetch())
                  .catch(setError)
                  .finally(() => setBusy(null));
              }}
            />
          </Card>
        ))
      ) : (
        <EmptyState
          title="No active sessions"
          description="Sign in again to continue."
        />
      )}
    </Screen>
  );
}
