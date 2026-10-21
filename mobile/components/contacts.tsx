import React, { useState, useEffect } from "react";
import { View, FlatList, Pressable, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Plus, ChevronRight, Search } from "lucide-react-native";
import { type Contact, rupees } from "@tamiltrade/shared";
import { api, type Page } from "../services/api";
import { hasPermission } from "../store/session";
import {
  T,
  Card,
  Row,
  Button,
  Field,
  ErrorNotice,
  EmptyState,
  LoadingSkeleton,
  AppBrand,
  BackButton,
} from "./ui";
import { useTheme } from "../theme";
import { AddByVoice } from "./add-by-voice";
export function ContactsScreen({
  kind,
  back = false,
}: {
  kind: "customer" | "supplier";
  back?: boolean;
}) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);
  const q = useInfiniteQuery({
    queryKey: ["contacts", kind, debounced],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Page<Contact>>(
        `/api/contacts?kind=${kind}&search=${encodeURIComponent(debounced)}&page=${pageParam}`,
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
          gap: 12,
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
          <View style={{ gap: 18, paddingBottom: 8 }}>
            {back && <BackButton />}
            {!back && <AppBrand />}
            <T size={25} weight="bold">
              {kind === "customer" ? "Customers" : "Suppliers"}
            </T>
            <T color={c.muted} size={13}>
              {kind === "customer"
                ? "Accounts, balances and payment history."
                : "Purchase partners and outstanding balances."}
            </T>
            <Field
              label={`Search ${kind}s`}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name"
            />
            {hasPermission("contacts") && (
              <Row>
                <View style={{ flex: 1 }}>
                  <Button
                    title={`Add ${kind}`}
                    icon={<Plus size={18} color={c.accentText} />}
                    onPress={() =>
                      router.push({
                        pathname: "/contact-form",
                        params: { kind },
                      })
                    }
                  />
                </View>
                <AddByVoice kind={kind} />
              </Row>
            )}
            <ErrorNotice error={q.error} retry={() => void q.refetch()} />
          </View>
        }
        ListEmptyComponent={
          q.isPending ? (
            <LoadingSkeleton />
          ) : (
            <EmptyState
              title={search ? "No matching contacts" : `Add your first ${kind}`}
              description={
                search
                  ? "Try a different name or clear your search."
                  : "Create a contact to begin tracking transactions and payments."
              }
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name}`}
            onPress={() =>
              router.push({
                pathname: "/contact/[id]",
                params: { id: item._id },
              })
            }
          >
            <Card
              style={{
                padding: 16,
              }}
            >
              <Row>
                <View
                  style={{
                    width: 43,
                    height: 43,
                    borderRadius: 14,
                    backgroundColor: c.soft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <T color={c.accent} weight="bold">
                    {item.name.slice(0, 2).toUpperCase()}
                  </T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight="bold">{item.name}</T>
                  <T size={11} color={c.muted}>
                    {item.phone || `${item.paymentTermsDays} day terms`}
                  </T>
                </View>
                <ChevronRight color={c.muted} size={18} />
              </Row>
              <Row>
                <T color={c.muted} size={12}>
                  {kind === "customer" ? "Receivable" : "Payable"}
                </T>
                <T
                  size={20}
                  color={item.balance > 0 ? c.warning : c.accent}
                  weight="bold"
                >
                  {rupees(item.balance)}
                </T>
              </Row>
            </Card>
          </Pressable>
        )}
        ListFooterComponent={
          q.isFetchingNextPage ? <LoadingSkeleton /> : undefined
        }
      />
    </SafeAreaView>
  );
}
