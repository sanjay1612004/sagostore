import React, { useState } from "react";
import { View, useWindowDimensions, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import {
  ArrowUpRight,
  Plus,
  Mic,
  Sparkles,
  Wallet,
  ShoppingBag,
  Users,
  Factory,
  Package,
  BarChart3,
  TrendingUp,
} from "lucide-react-native";
import { LineChart } from "react-native-gifted-charts";
import { type Dashboard } from "@tamiltrade/shared";
import { api } from "../../services/api";
import { selectionFeedback } from "../../services/haptics";
import { useSession, hasPermission } from "../../store/session";
import { useTheme, useCopy } from "../../theme";
import {
  Screen,
  T,
  Row,
  Card,
  Button,
  ErrorNotice,
  EmptyState,
  LoadingSkeleton,
  PremiumBalanceCard,
  FinancialMetricCard,
  TransactionRow,
  PaymentStatusChip,
} from "../../components/ui";

function SalesOverview({ data }: { data: Dashboard }) {
  const c = useTheme();
  const [plotWidth, setPlotWidth] = useState(0);
  return (
    <Card style={{ minHeight: 290 }}>
      <Row>
        <View style={{ gap: 3 }}>
          <T size={17} weight="bold">
            Sales overview
          </T>
          <T size={12} color={c.muted}>
            Your daily sales this month
          </T>
        </View>
        <View
          style={{ backgroundColor: c.blueSoft, padding: 9, borderRadius: 12 }}
        >
          <BarChart3 size={19} color={c.blue} />
        </View>
      </Row>
      <View
        onLayout={(event) => setPlotWidth(event.nativeEvent.layout.width)}
        style={{ minHeight: 200, justifyContent: "center", gap: 10 }}
      >
        {data.trend.length > 1 && plotWidth > 0 ? (
          <LineChart
            data={data.trend.map((point, i) => ({
              value: point.sales / 100,
              label:
                i === 0 || i === data.trend.length - 1
                  ? point.date.slice(8)
                  : "",
            }))}
            width={Math.max(120, plotWidth - 62)}
            height={155}
            color={c.accent}
            thickness={3}
            areaChart
            startFillColor={c.accent}
            endFillColor={c.surface}
            startOpacity={0.22}
            endOpacity={0}
            hideDataPoints
            curved
            hideRules
            yAxisTextStyle={{ color: c.muted, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: c.muted, fontSize: 10 }}
            xAxisColor={c.border}
            yAxisColor="transparent"
          />
        ) : (
          <View style={{ alignItems: "center", gap: 12, padding: 20 }}>
            <View
              style={{ padding: 14, borderRadius: 18, backgroundColor: c.soft }}
            >
              <TrendingUp size={28} color={c.accent} />
            </View>
            <T weight="medium">Watch your business grow</T>
            <T
              size={12}
              color={c.muted}
              style={{ textAlign: "center", maxWidth: 280 }}
            >
              Your chart will appear after sales are recorded on two different
              days.
            </T>
          </View>
        )}
      </View>
    </Card>
  );
}

function VoiceShortcut({ featured = false }: { featured?: boolean }) {
  const c = useTheme();
  return (
    <Card
      style={{
        backgroundColor: c.soft,
        borderColor: c.soft,
        minHeight: featured ? 220 : undefined,
        justifyContent: "center",
      }}
    >
      <Row>
        <View style={{ flex: 1, gap: 7 }}>
          <Row style={{ justifyContent: "flex-start", gap: 7 }}>
            <Sparkles color={c.accent} size={15} />
            <T size={10} color={c.accent} weight="bold">
              YOUR AI BUSINESS ASSISTANT
            </T>
          </Row>
          <T size={20} weight="bold">
            Less typing. More doing.
          </T>
          <T size={12} color={c.muted}>
            Speak in Tamil, Tanglish or English. Review the details, then
            confirm.
          </T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Tamil voice assistant"
          onPress={() => router.push("/(tabs)/voice")}
          style={{ backgroundColor: c.accent, padding: 17, borderRadius: 20 }}
        >
          <Mic size={26} color={c.accentText} />
        </Pressable>
      </Row>
    </Card>
  );
}

export default function Home() {
  const c = useTheme(),
    copy = useCopy(),
    user = useSession((s) => s.user);
  const allowed = hasPermission("reports");
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/api/dashboard"),
    enabled: allowed,
  });
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  const data = q.data;
  const actions = [
    {
      title: "Purchase",
      detail: "Stock coming in",
      icon: Plus,
      color: c.blue,
      background: c.blueSoft,
      path: { pathname: "/trade", params: { kind: "purchase" } },
      show: hasPermission("purchases"),
    },
    {
      title: "New sale",
      detail: "Keep business moving",
      icon: ArrowUpRight,
      color: c.success,
      background: c.successSoft,
      path: { pathname: "/trade", params: { kind: "sale" } },
      show: hasPermission("sales"),
    },
    {
      title: "Payment",
      detail: "Settle an account",
      icon: Wallet,
      color: c.violet,
      background: c.violetSoft,
      path: "/payments",
      show: hasPermission("payments"),
    },
    {
      title: "Reports",
      detail: "See the bigger picture",
      icon: BarChart3,
      color: c.warning,
      background: c.warningSoft,
      path: "/reports",
      show: hasPermission("reports"),
    },
  ];
  const metrics = data
    ? [
        {
          label: "Today's sales",
          value: data.todaySales,
          tone: "mint" as const,
          icon: <ArrowUpRight size={17} color={c.success} />,
        },
        {
          label: "Payments received",
          value: data.paymentsReceived,
          tone: "blue" as const,
          icon: <Wallet size={17} color={c.blue} />,
        },
        {
          label: "Customer outstanding",
          value: data.receivables,
          tone: "amber" as const,
          icon: <Users size={17} color={c.warning} />,
        },
        {
          label: "Supplier payables",
          value: data.payables,
          tone: "coral" as const,
          icon: <Factory size={17} color={c.danger} />,
        },
        {
          label: "Today's purchases",
          value: data.todayPurchases,
          tone: "violet" as const,
          icon: <ShoppingBag size={17} color={c.violet} />,
        },
        {
          label: "Warehouse units",
          value: data.stock,
          tone: "blue" as const,
          icon: <Package size={17} color={c.blue} />,
          unit: true,
        },
      ]
    : [];
  return (
    <Screen
      maxWidth={1160}
      title={copy(`Hello, ${user?.name.split(" ")[0] ?? "there"}.`, "வணக்கம்!")}
      subtitle={copy(
        "Let's make today a good business day.",
        "இன்னைக்கு என்ன கணக்கு போடலாம்?",
      )}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Business profile"
          onPress={() => router.push("/profile")}
          style={{
            width: 44,
            height: 44,
            borderRadius: 15,
            backgroundColor: c.soft,
            borderWidth: 2,
            borderColor: c.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T weight="bold" color={c.accent} size={17}>
            {user?.name.slice(0, 1).toUpperCase()}
          </T>
        </Pressable>
      }
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
    >
      <Row style={{ flexWrap: "wrap" }}>
        <T size={11} color={c.muted} weight="bold" style={{ letterSpacing: 1 }}>
          YOUR BUSINESS AT A GLANCE
        </T>
        <PaymentStatusChip
          label={
            data
              ? q.error
                ? "CACHED RECORDS"
                : "LIVE RECORDS"
              : "CONNECTED ACCOUNT"
          }
          tone="success"
        />
      </Row>
      <ErrorNotice error={q.error} retry={() => void q.refetch()} />
      {!allowed && (
        <Card>
          <T>
            You’re signed in as staff. Use the actions below to manage your
            assigned workflows.
          </T>
        </Card>
      )}
      <View style={{ flexDirection: wide ? "row" : "column", gap: 20 }}>
        {allowed && (
          <View style={{ flex: wide ? 1.4 : undefined, minWidth: 0 }}>
            {q.isPending && allowed ? (
              <LoadingSkeleton />
            ) : (
              data && (
                <PremiumBalanceCard
                  label="MONTHLY REVENUE"
                  value={data.monthlyRevenue}
                  caption="Verified sales · current calendar month"
                />
              )
            )}
          </View>
        )}
        {wide && (
          <View style={{ flex: 1, minWidth: 0 }}>
            <VoiceShortcut featured />
          </View>
        )}
      </View>
      {metrics.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {metrics.map((metric) => (
            <View
              key={metric.label}
              style={{
                flexBasis: width < 360 ? "100%" : wide ? "30%" : "45%",
                flexGrow: 1,
                minWidth: 0,
              }}
            >
              <FinancialMetricCard {...metric} />
            </View>
          ))}
        </View>
      )}
      <View style={{ gap: 14 }}>
        <T size={19} weight="bold">
          Quick actions
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {actions
            .filter((action) => action.show)
            .map((action) => (
              <Pressable
                key={action.title}
                accessibilityRole="button"
                accessibilityLabel={action.title}
                onPress={() => {
                  void selectionFeedback();
                  router.push(action.path as Href);
                }}
                style={({ pressed }) => ({
                  flexBasis: wide ? "22%" : "45%",
                  flexGrow: 1,
                  minWidth: 0,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: pressed ? action.color : c.border,
                  borderRadius: 20,
                  padding: 18,
                  gap: 12,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View
                  style={{
                    alignSelf: "flex-start",
                    padding: 11,
                    borderRadius: 13,
                    backgroundColor: action.background,
                  }}
                >
                  <action.icon size={22} color={action.color} />
                </View>
                <View style={{ gap: 3 }}>
                  <T weight="bold">{action.title}</T>
                  <T size={11} color={c.muted}>
                    {action.detail}
                  </T>
                </View>
              </Pressable>
            ))}
        </View>
      </View>
      {!wide && <VoiceShortcut />}
      {data && (
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            gap: 20,
            alignItems: "stretch",
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <SalesOverview data={data} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
            <Row>
              <T size={19} weight="bold">
                Recent activity
              </T>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View all transactions"
                onPress={() => router.push("/(tabs)/transactions")}
                style={{ padding: 8 }}
              >
                <T color={c.accent} size={12} weight="medium">
                  View all →
                </T>
              </Pressable>
            </Row>
            {data.recent.length ? (
              data.recent.map((item) => (
                <TransactionRow key={item._id} item={item} />
              ))
            ) : (
              <EmptyState
                title="A fresh start"
                description="Your purchases, sales and payments will appear here."
                action={
                  <Button
                    title="Add a supplier"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: "/contact-form",
                        params: { kind: "supplier" },
                      })
                    }
                  />
                }
              />
            )}
          </View>
        </View>
      )}
      {data?.insights.map((insight, i) => (
        <Card
          key={i}
          style={{ borderColor: c.warningSoft, backgroundColor: c.warningSoft }}
        >
          <Row>
            <Sparkles color={c.warning} size={18} />
            <View style={{ flex: 1 }}>
              <T size={13}>{insight}</T>
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
