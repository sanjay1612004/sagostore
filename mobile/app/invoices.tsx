import React, { useState } from "react";
import { View, FlatList, Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { shareInvoicePdf } from "../services/invoice-file";
import { type TradeRecord, rupees } from "@tamiltrade/shared";
import {
  api,
  post,
  apiUrl,
  type Page,
  invalidateBusiness,
} from "../services/api";
import { useSession } from "../store/session";
import {
  T,
  Card,
  Row,
  Button,
  ErrorNotice,
  LoadingSkeleton,
  EmptyState,
  ConfirmationSheet,
  Select,
  Field,
  PaymentStatusChip,
} from "../components/ui";
import { useTheme } from "../theme";
type Invoice = {
  _id: string;
  saleId: string;
  status: "draft" | "issued" | "cancelled";
  number?: string;
  snapshot?: {
    business: { name: string };
    customer: { name: string; address: string };
    productName: string;
    subtotal: number;
    tax: number;
    total: number;
    sale: { quantity: number; unitPrice: string; date: string };
  };
};
function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const c = useTheme();
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState(false),
    [cancel, setCancel] = useState(false),
    [reason, setReason] = useState("");
  const owner = useSession((s) => s.user?.role === "owner");
  const sale = useQuery({
    queryKey: ["record", invoice.saleId],
    queryFn: () => api<TradeRecord>(`/api/records/${invoice.saleId}`),
    enabled: invoice.status === "draft",
  });
  const snapshot = invoice.snapshot;
  const task = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      await invalidateBusiness();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const sharePdf = () =>
    shareInvoicePdf(invoice._id, invoice.number ?? "invoice");
  return (
    <Card>
      <Row>
        <T weight="bold">{invoice.number ?? "Invoice draft"}</T>
        <PaymentStatusChip
          label={invoice.status.toUpperCase()}
          tone={
            invoice.status === "issued"
              ? "success"
              : invoice.status === "cancelled"
                ? "danger"
                : "warning"
          }
        />
      </Row>
      <T size={17}>
        {snapshot?.customer.name ?? sale.data?.contactName ?? "Loading sale…"}
      </T>
      <T size={25} weight="bold">
        {rupees(snapshot?.total ?? sale.data?.total ?? 0)}
      </T>
      {snapshot && (
        <>
          <T color={c.muted}>
            {snapshot.productName} · {snapshot.sale.quantity} units
          </T>
          <T size={12} color={c.muted}>
            {snapshot.sale.date} · {snapshot.business.name}
          </T>
        </>
      )}
      <ErrorNotice error={error ?? sale.error} />
      {invoice.status === "draft" && (
        <Button
          title="Review & issue invoice"
          disabled={!sale.data}
          onPress={() => setReview(true)}
        />
      )}
      {invoice.status === "issued" && (
        <>
          <Button
            title={
              Platform.OS === "web"
                ? "Download invoice PDF"
                : "Share invoice PDF"
            }
            busy={busy}
            onPress={() => void task(sharePdf)}
          />
          <Button
            title="Share WhatsApp message"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              void task(async () => {
                const link = await post<{ whatsappUrl: string }>(
                  `/api/invoices/${invoice._id}/share`,
                  {},
                );
                await Linking.openURL(link.whatsappUrl);
              })
            }
          />
          <Button
            title="Revoke shared links"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              void task(() =>
                api(`/api/invoices/${invoice._id}/share`, { method: "DELETE" }),
              )
            }
          />
          {owner && (
            <Button
              title="Cancel invoice"
              variant="danger"
              disabled={busy}
              onPress={() => setCancel(true)}
            />
          )}
        </>
      )}
      <ConfirmationSheet
        visible={review}
        onClose={() => {
          if (!busy) setReview(false);
        }}
      >
        <T>
          Issue this invoice with a permanent number and a snapshot of the
          current business and customer details.
        </T>
        <Card>
          <T size={21} weight="bold">
            {sale.data?.contactName}
          </T>
          <T>
            {sale.data?.productName} · {sale.data?.quantity} units
          </T>
          <Row>
            <T>Total</T>
            <T size={23} weight="bold">
              {rupees(sale.data?.total ?? 0)}
            </T>
          </Row>
          <T size={12} color={c.muted}>
            Check your business profile and tax settings before issue.
          </T>
        </Card>
        <ErrorNotice error={error} />
        <Button
          title="Confirm & issue"
          busy={busy}
          onPress={() =>
            void task(async () => {
              await post(`/api/invoices/${invoice._id}/issue`, {
                confirm: true,
              });
              setReview(false);
            })
          }
        />
      </ConfirmationSheet>
      <ConfirmationSheet
        visible={cancel}
        onClose={() => {
          if (!busy) setCancel(false);
        }}
      >
        <T>
          Cancel this invoice. This preserves its number and historical
          snapshot. Reverse the sale separately if needed.
        </T>
        <Field
          label="Cancellation reason"
          value={reason}
          onChangeText={setReason}
        />
        <ErrorNotice error={error} />
        <Button
          title="Confirm cancellation"
          variant="danger"
          busy={busy}
          onPress={() =>
            void task(async () => {
              await post(`/api/invoices/${invoice._id}/cancel`, { reason });
              setCancel(false);
            })
          }
        />
      </ConfirmationSheet>
    </Card>
  );
}
export default function Invoices() {
  const c = useTheme();
  const [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ["invoices"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Page<Invoice>>(`/api/invoices?page=${pageParam}`),
    getNextPageParam: (p) =>
      p.page * p.limit < p.total ? p.page + 1 : undefined,
  });
  const sales = useQuery({
    queryKey: ["invoice-sales"],
    queryFn: () => api<Page<TradeRecord>>("/api/records?kind=sale&limit=100"),
  });
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <FlatList
        contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 16 }}
        data={q.data?.pages.flatMap((p) => p.items) ?? []}
        keyExtractor={(i) => i._id}
        onRefresh={() => void q.refetch()}
        refreshing={q.isRefetching}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: 18, paddingBottom: 10 }}>
            <Button
              title="← Back"
              variant="secondary"
              onPress={() => router.back()}
            />
            <T size={30} weight="bold">
              Invoices
            </T>
            <T color={c.muted}>Beautiful bills. Secure sharing.</T>
            <Select
              label="Create draft from a confirmed sale"
              options={
                sales.data?.items
                  .filter((s) => s.status === "posted")
                  .map((s) => ({
                    value: s._id,
                    label: `${s.contactName} · ${s.date}`,
                    detail: rupees(s.total),
                  })) ?? []
              }
              onChange={(saleId) => {
                setBusy(true);
                void post("/api/invoices", { saleId })
                  .then(() => invalidateBusiness())
                  .catch(setError)
                  .finally(() => setBusy(false));
              }}
            />
            {busy && <T>Creating invoice draft…</T>}
            <ErrorNotice
              error={q.error ?? sales.error ?? error}
              retry={() => void q.refetch()}
            />
            <T size={12} color={c.muted}>
              Sharing opens your device’s share sheet or WhatsApp. You choose
              the recipient and send it.
            </T>
          </View>
        }
        ListEmptyComponent={
          q.isPending ? (
            <LoadingSkeleton />
          ) : (
            <EmptyState
              title="Your first invoice awaits"
              description="Confirm a sale, then create and review its invoice draft."
            />
          )
        }
        renderItem={({ item }) => <InvoiceCard invoice={item} />}
      />
    </SafeAreaView>
  );
}
