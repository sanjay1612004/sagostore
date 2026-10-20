import React, { useState } from "react";
import { View, FlatList, Pressable, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { type TradeRecord } from "@tamiltrade/shared";
import { api, type Page } from "../../services/api";
import { hasPermission } from "../../store/session";
import { useTheme } from "../../theme";
import {
  T,
  ErrorNotice,
  EmptyState,
  LoadingSkeleton,
  TransactionRow,
  Select,
  AppBrand,
} from "../../components/ui";
export default function Transactions() {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState("all");
  const options = [
    { value: "all", label: "All activity" },
    ...(hasPermission("purchases")
      ? [{ value: "purchase", label: "Purchases" }]
      : []),
    ...(hasPermission("sales") ? [{ value: "sale", label: "Sales" }] : []),
    ...(hasPermission("expenses")
      ? [{ value: "expense", label: "Expenses" }]
      : []),
    ...(hasPermission("payments")
      ? [
          { value: "customer_payment", label: "Customer payments" },
          { value: "supplier_payment", label: "Supplier payments" },
        ]
      : []),
  ];
  const q = useInfiniteQuery({
    queryKey: ["records", kind],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Page<TradeRecord>>(
        `/api/records?page=${pageParam}${kind !== "all" ? "&kind=" + kind : ""}`,
      ),
    getNextPageParam: (p) =>
      p.page * p.limit < p.total ? p.page + 1 : undefined,
  });
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <FlatList
        style={{ width: "100%", maxWidth: 1040, alignSelf: "center" }}
        contentContainerStyle={{
          padding: width < 600 ? 20 : 32,
          paddingBottom: 40,
        }}
        data={q.data?.pages.flatMap((p) => p.items) ?? []}
        keyExtractor={(i) => i._id}
        onRefresh={() => void q.refetch()}
        refreshing={q.isRefetching}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={{ gap: 16, paddingBottom: 20 }}>
            <AppBrand />
            <T size={25} weight="bold">
              Activity
            </T>
            <T color={c.muted} size={13}>
              Your confirmed transactions.
            </T>
            <Select
              label="Filter activity"
              value={kind}
              onChange={setKind}
              options={options}
            />
            <Select
              label="Add a transaction"
              options={options.filter((o) => o.value !== "all")}
              onChange={(value) =>
                router.push({ pathname: "/trade", params: { kind: value } })
              }
            />
            <ErrorNotice error={q.error} retry={() => void q.refetch()} />
          </View>
        }
        ListEmptyComponent={
          q.isPending ? (
            <LoadingSkeleton />
          ) : (
            <EmptyState
              title="Your activity starts here"
              description="Confirmed purchases, sales, expenses and payments appear in this ledger."
            />
          )
        }
        renderItem={({ item }) => <TransactionRow item={item} />}
        ListFooterComponent={
          q.isFetchingNextPage ? <LoadingSkeleton /> : undefined
        }
      />
    </SafeAreaView>
  );
}
