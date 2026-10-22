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
import { api, queryClient } from "../services/api";
import { useSession } from "../store/session";
import { useTheme } from "../theme";
type Session = {
  _id: string;
  device: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
  phoneUnlock: boolean;
};
export default function Security() {
  const c = useTheme();
  const q = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: () => api<Session[]>("/auth/sessions"),
  });
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState<string | null>(null);
  return (
    <Screen
      title="Connected devices"
      subtitle="Disconnect a device to remove its access to your account."
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
              {s.current ? " · This device" : ""}
            </T>
            <T color={c.muted} size={12}>
              Connected {new Date(s.createdAt).toLocaleString()}
            </T>
            <T color={c.muted} size={12}>
              {s.phoneUnlock
                ? "Phone unlock enabled"
                : `Session expires ${new Date(s.expiresAt).toLocaleDateString()}`}
            </T>
            <Button
              title="Disconnect"
              variant="danger"
              busy={busy === s._id}
              disabled={!!busy}
              onPress={() => {
                setBusy(s._id);
                void api(`/auth/sessions/${s._id}`, { method: "DELETE" })
                  .then(async () => {
                    if (s.current) {
                      queryClient.clear();
                      await useSession.getState().clear();
                    } else await q.refetch();
                  })
                  .catch(setError)
                  .finally(() => setBusy(null));
              }}
            />
          </Card>
        ))
      ) : (
        <EmptyState
          title="No active sessions"
          description="Connect this phone again to continue."
        />
      )}
    </Screen>
  );
}
