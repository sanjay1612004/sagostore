import React, { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { type TradeRecord, rupees } from "@tamiltrade/shared";
import { api, post, invalidateBusiness } from "../../services/api";
import { useSession, hasPermission } from "../../store/session";
import { useComposer } from "../../store/composer";
import {
  Screen,
  T,
  Card,
  Row,
  Button,
  Field,
  ErrorNotice,
  LoadingSkeleton,
  PaymentStatusChip,
  ConfirmationSheet,
} from "../../components/ui";
import { useTheme } from "../../theme";
export default function RecordDetails() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    c = useTheme();
  const q = useQuery({
    queryKey: ["record", id],
    queryFn: () => api<TradeRecord>(`/api/records/${id}`),
  });
  const [reason, setReason] = useState(""),
    [reverse, setReverse] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const owner = useSession((s) => s.user?.role === "owner"),
    r = q.data;
  const invoice = async () => {
    if (!r) return;
    setBusy(true);
    try {
      await post("/api/invoices", { saleId: r._id });
      await invalidateBusiness();
      router.push("/invoices");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      title="Transaction details"
      subtitle="A permanent, auditable business record."
      back
    >
      <ErrorNotice error={q.error ?? error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <LoadingSkeleton />
      ) : (
        r && (
          <>
            <Card>
              <Row>
                <PaymentStatusChip
                  label={r.kind.replaceAll("_", " ").toUpperCase()}
                  tone="success"
                />
                <PaymentStatusChip
                  label={r.status.toUpperCase()}
                  tone={r.status === "posted" ? "muted" : "danger"}
                />
              </Row>
              <T size={35} weight="bold">
                {rupees(r.total)}
              </T>
              <T size={20}>{r.contactName ?? r.category}</T>
              <T color={c.muted}>
                {r.date} · {r.reference || "No reference"}
              </T>
              {!!r.productName && (
                <T>
                  {r.productName} · {r.quantity} units · ₹{r.unitPrice}/unit
                </T>
              )}
              <Row>
                <T color={c.muted}>Tax</T>
                <T>{rupees(r.tax)}</T>
              </Row>
              {r.kind === "sale" && (
                <>
                  <Row>
                    <T color={c.muted}>Allocated landed cost</T>
                    <T>{rupees(r.cost)}</T>
                  </Row>
                  <Row>
                    <T color={c.muted}>Gross trading profit</T>
                    <T color={c.accent}>{rupees(r.total - r.tax - r.cost)}</T>
                  </Row>
                </>
              )}
              {(r.kind === "sale" || r.kind === "purchase") && (
                <>
                  <Row>
                    <T color={c.muted}>Paid</T>
                    <T>{rupees(r.paid)}</T>
                  </Row>
                  <Row>
                    <T color={c.muted}>Remaining</T>
                    <T>{rupees(r.total - r.paid)}</T>
                  </Row>
                  <T size={12} color={c.muted}>
                    {r.delivery === "direct"
                      ? "Direct mill-to-customer delivery"
                      : "Warehouse stock movement"}
                    {r.dueDate ? " · Due " + r.dueDate : ""}
                  </T>
                </>
              )}
              {!!r.notes && <T>{r.notes}</T>}
            </Card>
            {r.status === "posted" &&
              (r.kind === "sale" || r.kind === "purchase") &&
              r.total > r.paid &&
              hasPermission("payments") && (
                <Button
                  title="Record payment"
                  onPress={() => {
                    useComposer.getState().set({
                      kind:
                        r.kind === "sale"
                          ? "customer_payment"
                          : "supplier_payment",
                      contactId: r.contactId,
                      sourceId: r._id,
                    });
                    router.push("/trade");
                  }}
                />
              )}
            {r.kind === "sale" &&
              r.status === "posted" &&
              hasPermission("invoices") && (
                <Button
                  title="Create / open invoice"
                  variant="secondary"
                  busy={busy}
                  onPress={() => void invoice()}
                />
              )}
            {owner && r.status === "posted" && (
              <Button
                title="Reverse transaction"
                variant="danger"
                onPress={() => setReverse(true)}
              />
            )}
            <ConfirmationSheet
              visible={reverse}
              onClose={() => {
                if (!busy) setReverse(false);
              }}
            >
              <T>
                Reverse this transaction and its stock or balance effects. The
                original entry stays in your audit history.
              </T>
              <Field
                label="Reason for reversal · minimum 5 characters"
                value={reason}
                onChangeText={setReason}
              />
              <ErrorNotice error={error} />
              <Button
                title="Confirm reversal"
                variant="danger"
                busy={busy}
                onPress={() => {
                  setBusy(true);
                  setError(undefined);
                  void post(`/api/records/${id}/reverse`, { reason })
                    .then(async () => {
                      setReverse(false);
                      await invalidateBusiness();
                    })
                    .catch(setError)
                    .finally(() => setBusy(false));
                }}
              />
            </ConfirmationSheet>
          </>
        )
      )}
    </Screen>
  );
}
