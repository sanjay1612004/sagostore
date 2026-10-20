import React, { useState } from "react";
import { View, Pressable, useWindowDimensions } from "react-native";
import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Mic,
  Plus,
  Wallet,
  ChevronRight,
} from "lucide-react-native";
import { type Dashboard, rupees } from "@tamiltrade/shared";
import { api } from "../../services/api";
import { hasPermission, useSession } from "../../store/session";
import { useTheme, useCopy } from "../../theme";
import { ThemeToggle } from "../../components/theme-toggle";
import {
  Screen,
  T,
  Row,
  Card,
  Button,
  ErrorNotice,
  EmptyState,
  LoadingSkeleton,
  TransactionRow,
} from "../../components/ui";

export default function Home() {
  const c = useTheme(),
    copy = useCopy();
  const user = useSession((s) => s.user);
  const [themeError, setThemeError] = useState<unknown>();
  const { width } = useWindowDimensions();
  const allowed = hasPermission("reports");
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/api/dashboard"),
    enabled: allowed,
  });
  const data = allowed ? q.data : undefined;
  const actions = [
    {
      label: "New sale",
      icon: ArrowUpRight,
      path: { pathname: "/trade", params: { kind: "sale" } },
      show: hasPermission("sales"),
    },
    {
      label: "Purchase",
      icon: Plus,
      path: { pathname: "/trade", params: { kind: "purchase" } },
      show: hasPermission("purchases"),
    },
    {
      label: "Payment",
      icon: Wallet,
      path: "/payments",
      show: hasPermission("payments"),
    },
  ].filter((action) => action.show);
  return (
    <Screen
      maxWidth={1040}
      title={copy(`Hello, ${user?.name.split(" ")[0] ?? "there"}`, "வணக்கம்!")}
      subtitle={copy(
        "Your business, at a glance.",
        "உங்கள் வியாபாரத்தின் இன்றைய நிலவரம்.",
      )}
      refreshing={q.isRefetching}
      onRefresh={allowed ? () => void q.refetch() : undefined}
      action={
        <Row style={{ gap: 8 }}>
          <ThemeToggle onError={setThemeError} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              user?.role === "owner" ? "Business profile" : "Account settings"
            }
            onPress={() =>
              router.push(user?.role === "owner" ? "/profile" : "/settings")
            }
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: c.elevated,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <T color={c.accent} weight="bold">
              {user?.name.slice(0, 1).toUpperCase()}
            </T>
          </Pressable>
        </Row>
      }
    >
      <ErrorNotice
        error={themeError ?? q.error}
        retry={themeError ? undefined : () => void q.refetch()}
      />
      {allowed && q.isPending && <LoadingSkeleton />}
      {data && (
        <Card
          style={{
            backgroundColor: c.soft,
            borderColor: c.soft,
            padding: width < 600 ? 22 : 28,
            gap: 18,
          }}
        >
          <Row>
            <T color={c.muted} weight="medium">
              Today's sales
            </T>
            <ArrowUpRight size={21} color={c.accent} />
          </Row>
          <T
            size={width < 380 ? 32 : 40}
            weight="bold"
            style={{ letterSpacing: -1 }}
          >
            {rupees(data.todaySales)}
          </T>
          <Row
            style={{
              paddingTop: 15,
              borderTopWidth: 1,
              borderColor: c.border,
              alignItems: "flex-start",
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <T size={12} color={c.muted}>
                Today's purchases
              </T>
              <T size={17} weight="medium">
                {rupees(data.todayPurchases)}
              </T>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <T size={12} color={c.muted}>
                Payments received
              </T>
              <T size={17} weight="medium">
                {rupees(data.paymentsReceived)}
              </T>
            </View>
          </Row>
          {q.error && (
            <T size={12} color={c.warning}>
              Showing your last loaded figures.
            </T>
          )}
        </Card>
      )}
      <View style={{ gap: 12 }}>
        <T size={16} weight="bold">
          {actions.length ? "Record a transaction" : "Your workspace"}
        </T>
        <Row style={{ gap: 10, alignItems: "stretch" }}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => router.push(action.path as Href)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 91,
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                borderRadius: 16,
                backgroundColor: pressed ? c.elevated : c.surface,
                borderWidth: 1,
                borderColor: c.border,
              })}
            >
              <action.icon size={21} color={c.accent} />
              <T size={12} weight="medium">
                {action.label}
              </T>
            </Pressable>
          ))}
        </Row>
        {!actions.length && (
          <T color={c.muted}>Your available business tools are under More.</T>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Tamil voice assistant"
        onPress={() => router.push("/(tabs)/voice")}
        style={({ pressed }) => ({
          padding: 17,
          borderRadius: 18,
          backgroundColor: pressed ? c.elevated : c.surface,
          borderWidth: 1,
          borderColor: c.border,
        })}
      >
        <Row>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              backgroundColor: c.soft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Mic size={22} color={c.accent} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <T weight="bold">Prefer to say it?</T>
            <T size={12} color={c.muted}>
              Tamil, Tanglish or English. We'll ask for any missing details.
            </T>
          </View>
          <ChevronRight size={18} color={c.muted} />
        </Row>
      </Pressable>
      {data && (
        <View
          style={{
            flexDirection: width >= 850 ? "row" : "column",
            gap: 20,
            alignItems: "stretch",
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
            <Row>
              <T size={16} weight="bold">
                Outstanding balances
              </T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open reports"
                onPress={() => router.push("/reports")}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <T color={c.accent} size={12}>
                  View reports
                </T>
              </Pressable>
            </Row>
            <Card>
              <Row>
                <View
                  style={{
                    padding: 9,
                    borderRadius: 12,
                    backgroundColor: c.soft,
                  }}
                >
                  <ArrowDownLeft size={18} color={c.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={13}>Customers owe you</T>
                  <T size={11} color={c.muted}>
                    Unpaid customer balances
                  </T>
                </View>
                <T weight="bold">{rupees(data.receivables)}</T>
              </Row>
              <View
                style={{
                  height: 1,
                  backgroundColor: c.border,
                  marginVertical: 3,
                }}
              />
              <Row>
                <View
                  style={{
                    padding: 9,
                    borderRadius: 12,
                    backgroundColor: c.elevated,
                  }}
                >
                  <ArrowUpRight size={18} color={c.muted} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={13}>You owe suppliers</T>
                  <T size={11} color={c.muted}>
                    Unpaid purchase balances
                  </T>
                </View>
                <T weight="bold">{rupees(data.payables)}</T>
              </Row>
            </Card>
          </View>
          <View style={{ flex: 1.2, minWidth: 0, gap: 12 }}>
            <Row>
              <T size={16} weight="bold">
                Recent activity
              </T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View all transactions"
                onPress={() => router.push("/(tabs)/transactions")}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <T color={c.accent} size={12}>
                  View all
                </T>
              </Pressable>
            </Row>
            {data.recent.length ? (
              <Card style={{ paddingVertical: 2, gap: 0 }}>
                {data.recent.slice(0, 3).map((item) => (
                  <TransactionRow key={item._id} item={item} compact />
                ))}
              </Card>
            ) : (
              <EmptyState
                title="No activity yet"
                description="Your confirmed sales, purchases and payments will appear here."
                action={
                  hasPermission("purchases") ? (
                    <Button
                      title="Record a purchase"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: "/trade",
                          params: { kind: "purchase" },
                        })
                      }
                    />
                  ) : undefined
                }
              />
            )}
          </View>
        </View>
      )}
      {!allowed && (
        <Card>
          <T color={c.muted}>
            Your account shows the tools assigned to you. Ask your business
            owner if you need additional access.
          </T>
        </Card>
      )}
    </Screen>
  );
}
