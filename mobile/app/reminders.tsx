import React, { useState } from "react";
import { Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { rupees } from "@tamiltrade/shared";
import {
  Screen,
  T,
  Card,
  Row,
  Button,
  ErrorNotice,
  LoadingSkeleton,
  EmptyState,
} from "../components/ui";
import { api } from "../services/api";
import { useTheme } from "../theme";
import { STORE_NAME } from "../config/brand";
type Reminder = {
  _id: string;
  kind: "sale" | "purchase";
  contactName: string;
  dueDate: string;
  total: number;
  paid: number;
};
export default function Reminders() {
  const c = useTheme();
  const q = useQuery({
    queryKey: ["reminders"],
    queryFn: () => api<Reminder[]>("/api/reminders"),
  });
  const [error, setError] = useState<unknown>(),
    [scheduled, setScheduled] = useState<string[]>([]);
  const schedule = async (r: Reminder) => {
    try {
      const Notifications = await import("expo-notifications");
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync("payments", {
          name: "Payment reminders",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Enable notifications in device settings to schedule reminders.",
        );
      const date = new Date();
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
      const identifier = `payment-${r._id}`;
      await Notifications.cancelScheduledNotificationAsync(identifier);
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: `${STORE_NAME} · Payment reminder`,
          body: `${r.contactName}: ${rupees(r.total - r.paid)} ${r.kind === "sale" ? "receivable" : "payable"}`,
          data: { recordId: r._id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: "payments",
        },
      });
      setScheduled((s) => [...s, r._id]);
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Screen
      title="Payment reminders"
      subtitle="Overdue customer and supplier accounts."
      back
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      <ErrorNotice error={q.error ?? error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <LoadingSkeleton />
      ) : q.data?.length ? (
        q.data.map((r) => (
          <Card key={r._id}>
            <Row>
              <T weight="bold">{r.contactName}</T>
              <T color={c.warning}>{rupees(r.total - r.paid)}</T>
            </Row>
            <T color={c.muted} size={12}>
              {r.kind === "sale" ? "Customer receivable" : "Supplier payable"} ·
              Due {r.dueDate}
            </T>
            <Button
              title={
                scheduled.includes(r._id)
                  ? "Reschedule for tomorrow, 9 am"
                  : "Remind me tomorrow, 9 am"
              }
              variant="secondary"
              disabled={Platform.OS === "web"}
              onPress={() => void schedule(r)}
            />
            {Platform.OS === "web" && (
              <T size={12} color={c.muted}>
                Schedule device reminders in the Android or iOS app.
              </T>
            )}
            {scheduled.includes(r._id) && (
              <T color={c.accent} size={12}>
                Reminder scheduled on this device.
              </T>
            )}
          </Card>
        ))
      ) : (
        <EmptyState
          title="Nothing overdue"
          description="Accounts due today or earlier will appear here when a balance remains."
        />
      )}
      <T size={12} color={c.muted}>
        Times use this device’s timezone. Reminders use the balance shown when
        scheduled; refresh balances before collecting. No customer message is
        sent.
      </T>
    </Screen>
  );
}
