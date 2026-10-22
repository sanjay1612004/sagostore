import React from "react";
import { Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import {
  Package,
  Factory,
  Wallet,
  ChartNoAxesCombined,
  FileText,
  Settings,
  Building2,
  Users,
  Shield,
  Bell,
  ChevronRight,
  Tag,
} from "lucide-react-native";
import { Screen, T, Row, Card } from "../../components/ui";
import { useTheme } from "../../theme";
import { hasPermission, useSession } from "../../store/session";
import { STORE_NAME } from "../../config/brand";
export default function More() {
  const c = useTheme(),
    owner = useSession((s) => s.user?.role === "owner");
  const items = [
    {
      label: "Suppliers",
      detail: "Mills, accounts & ledgers",
      path: "/suppliers",
      icon: Factory,
      show: true,
    },
    {
      label: "Inventory",
      detail: "Products, lots & warehouse stock",
      path: "/inventory",
      icon: Package,
      show: true,
    },
    {
      label: "Record payment",
      detail: "Customer & supplier allocations",
      path: "/payments",
      icon: Wallet,
      show: hasPermission("payments"),
    },
    {
      label: "Profit & reports",
      detail: "Revenue, costs & trading profit",
      path: "/reports",
      icon: ChartNoAxesCombined,
      show: hasPermission("reports"),
    },
    {
      label: "Mill prices",
      detail: "Historical purchase comparisons",
      path: "/prices",
      icon: Tag,
      show: hasPermission("reports"),
    },
    {
      label: "Invoices",
      detail: "Issue, download & share bills",
      path: "/invoices",
      icon: FileText,
      show: hasPermission("invoices"),
    },
    {
      label: "Payment reminders",
      detail: "Overdue invoices & payables",
      path: "/reminders",
      icon: Bell,
      show: true,
    },
    {
      label: "Business profile",
      detail: "Your store & billing details",
      path: "/profile",
      icon: Building2,
      show: owner,
    },
    {
      label: "Staff & permissions",
      detail: "Manage access to your business",
      path: "/staff",
      icon: Users,
      show: owner,
    },
    {
      label: "Connected devices",
      detail: "Review and disconnect devices",
      path: "/security",
      icon: Shield,
      show: true,
    },
    {
      label: "Settings",
      detail: "Appearance, language & phone access",
      path: "/settings",
      icon: Settings,
      show: true,
    },
  ];
  return (
    <Screen title="More" subtitle="Your business tools, in one place.">
      {[
        {
          title: "Business",
          paths: ["/suppliers", "/inventory", "/payments", "/invoices"],
        },
        { title: "Insights", paths: ["/reports", "/reminders", "/prices"] },
        {
          title: "Manage",
          paths: ["/profile", "/staff", "/security", "/settings"],
        },
      ].map((group) => (
        <View key={group.title} style={{ gap: 10 }}>
          <T size={13} weight="medium" color={c.muted}>
            {group.title}
          </T>
          <Card style={{ paddingVertical: 0, gap: 0 }}>
            {items
              .filter((item) => item.show && group.paths.includes(item.path))
              .sort(
                (a, b) =>
                  group.paths.indexOf(a.path) - group.paths.indexOf(b.path),
              )
              .map((item, i) => (
                <Pressable
                  key={item.path}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => router.push(item.path as Href)}
                  style={({ pressed }) => ({
                    paddingVertical: 16,
                    minHeight: 70,
                    borderTopWidth: i ? 1 : 0,
                    borderColor: c.border,
                    opacity: pressed ? 0.65 : 1,
                  })}
                >
                  <Row>
                    <View
                      style={{
                        backgroundColor: c.elevated,
                        padding: 9,
                        borderRadius: 11,
                      }}
                    >
                      <item.icon color={c.accent} size={19} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T weight="medium">{item.label}</T>
                      <T size={11} color={c.muted}>
                        {item.detail}
                      </T>
                    </View>
                    <ChevronRight size={18} color={c.muted} />
                  </Row>
                </Pressable>
              ))}
          </Card>
        </View>
      ))}
      <T size={11} color={c.muted} style={{ textAlign: "center" }}>
        {STORE_NAME} · Your everyday business assistant
      </T>
    </Screen>
  );
}
