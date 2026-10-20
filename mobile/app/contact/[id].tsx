import React from "react";
import { View, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { type Contact, type TradeRecord, rupees } from "@tamiltrade/shared";
import { api, type Page } from "../../services/api";
import { hasPermission } from "../../store/session";
import {
  T,
  Card,
  Row,
  Button,
  ErrorNotice,
  LoadingSkeleton,
  EmptyState,
  TransactionRow,
  PremiumBalanceCard,
} from "../../components/ui";
import { useTheme } from "../../theme";
import { useComposer } from "../../store/composer";
export default function ContactDetails() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    c = useTheme();
  const contact = useQuery({
    queryKey: ["contact", id],
    queryFn: () => api<Contact>(`/api/contacts/${id}`),
  });
  const ledger = useInfiniteQuery({
    queryKey: ["ledger", id],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Page<TradeRecord>>(`/api/contacts/${id}/ledger?page=${pageParam}`),
    getNextPageParam: (p) =>
      p.page * p.limit < p.total ? p.page + 1 : undefined,
  });
  const r = contact.data;
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <FlatList
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        data={ledger.data?.pages.flatMap((p) => p.items) ?? []}
        keyExtractor={(i) => i._id}
        onRefresh={() => {
          void contact.refetch();
          void ledger.refetch();
        }}
        refreshing={ledger.isRefetching}
        onEndReached={() => {
          if (ledger.hasNextPage && !ledger.isFetchingNextPage)
            void ledger.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: 20, paddingBottom: 16 }}>
            <Button
              title="← Back"
              variant="secondary"
              onPress={() => router.back()}
            />
            <ErrorNotice
              error={contact.error ?? ledger.error}
              retry={() => {
                void contact.refetch();
                void ledger.refetch();
              }}
            />
            {contact.isPending ? (
              <LoadingSkeleton />
            ) : (
              r && (
                <>
                  <T size={29} weight="bold">
                    {r.name}
                  </T>
                  <PremiumBalanceCard
                    label={
                      r.kind === "customer"
                        ? "CUSTOMER RECEIVABLE"
                        : "SUPPLIER PAYABLE"
                    }
                    value={r.balance}
                    caption={`${r.paymentTermsDays} day payment terms`}
                  />
                  <Card>
                    <T>{r.phone || "No phone added"}</T>
                    <T color={c.muted}>{r.address || "No address added"}</T>
                    <T color={c.muted} size={12}>
                      {r.aliases.join(" · ") || "No voice aliases added"}
                    </T>
                  </Card>
                  {hasPermission("contacts") && (
                    <Button
                      title="Edit contact"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: "/contact-form",
                          params: {
                            kind: r.kind,
                            id: r._id,
                            data: JSON.stringify(r),
                          },
                        })
                      }
                    />
                  )}
                  {hasPermission(
                    r.kind === "customer" ? "sales" : "purchases",
                  ) && (
                    <Button
                      title={
                        r.kind === "customer"
                          ? "Create sale"
                          : "Record purchase"
                      }
                      onPress={() => {
                        useComposer.getState().set({
                          kind: r.kind === "customer" ? "sale" : "purchase",
                          contactId: r._id,
                        });
                        router.push("/trade");
                      }}
                    />
                  )}
                  <T size={19} weight="bold">
                    Account ledger
                  </T>
                </>
              )
            )}
          </View>
        }
        ListEmptyComponent={
          ledger.isPending ? (
            <LoadingSkeleton />
          ) : (
            <EmptyState
              title="No ledger entries"
              description="Confirmed transactions for this contact will appear here."
            />
          )
        }
        renderItem={({ item }) => <TransactionRow item={item} />}
      />
    </SafeAreaView>
  );
}
