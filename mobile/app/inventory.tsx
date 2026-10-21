import React from "react";
import { View, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { type TradeRecord } from "@tamiltrade/shared";
import { api, type Page } from "../services/api";
import {
  T,
  Card,
  Row,
  Button,
  BackButton,
  ErrorNotice,
  EmptyState,
  LoadingSkeleton,
  PaymentStatusChip,
} from "../components/ui";
import { useTheme } from "../theme";
import { hasPermission } from "../store/session";
import { AddByVoice } from "../components/add-by-voice";
type Lot = TradeRecord & {
  availableQuantity: number;
  warehouseQuantity: number;
};
export default function Inventory() {
  const c = useTheme();
  const q = useInfiniteQuery({
    queryKey: ["inventory"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Page<Lot>>(`/api/inventory?page=${pageParam}`),
    getNextPageParam: (p) =>
      p.page * p.limit < p.total ? p.page + 1 : undefined,
  });
  const stock = useQuery({
    queryKey: ["product-stock"],
    queryFn: () =>
      api<
        {
          _id: string;
          name: string;
          unit: string;
          weightGrams: number;
          available: number;
          lowStockQuantity: number;
        }[]
      >("/api/inventory/products"),
  });
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <FlatList
        contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 14 }}
        data={q.data?.pages.flatMap((p) => p.items) ?? []}
        keyExtractor={(i) => i._id}
        onRefresh={() => {
          void q.refetch();
          void stock.refetch();
        }}
        refreshing={q.isRefetching}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: 18, paddingBottom: 10 }}>
            <BackButton />
            <T size={30} weight="bold">
              Inventory
            </T>
            <T color={c.muted}>Every lot, from mill to customer.</T>
            {hasPermission("contacts") && (
              <Row>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Add product"
                    onPress={() => router.push("/product-form")}
                  />
                </View>
                <AddByVoice kind="product" />
              </Row>
            )}
            <ErrorNotice
              error={q.error ?? stock.error}
              retry={() => {
                void q.refetch();
                void stock.refetch();
              }}
            />
            {stock.data?.map((p) => (
              <Card key={p._id}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <T weight="bold">{p.name}</T>
                    <T size={12} color={c.muted}>
                      {(p.available * p.weightGrams) / 1000} kg in warehouse
                    </T>
                  </View>
                  <T size={24} weight="bold">
                    {p.available} {p.unit}
                  </T>
                </Row>
                {p.available <= p.lowStockQuantity && (
                  <PaymentStatusChip label="LOW STOCK" tone="warning" />
                )}
              </Card>
            ))}
            <T size={19} weight="bold">
              Purchase lots
            </T>
          </View>
        }
        ListEmptyComponent={
          q.isPending ? (
            <LoadingSkeleton />
          ) : (
            <EmptyState
              title="Your warehouse is ready"
              description="Confirm a purchase to create a stock lot. Direct deliveries are tracked separately."
            />
          )
        }
        renderItem={({ item }) => (
          <Card>
            <Row>
              <T weight="bold">{item.productName}</T>
              <PaymentStatusChip
                label={item.delivery.toUpperCase()}
                tone={item.delivery === "warehouse" ? "success" : "muted"}
              />
            </Row>
            <T color={c.muted}>
              {item.contactName} · {item.date}
            </T>
            <Row>
              <T>Available</T>
              <T size={22} weight="bold" color={c.accent}>
                {item.availableQuantity} units
              </T>
            </Row>
            <T size={12} color={c.muted}>
              {item.quantity} received · {item.allocatedQuantity} sold
            </T>
            <Button
              title="View lot transaction"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/records/[id]",
                  params: { id: item._id },
                })
              }
            />
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
