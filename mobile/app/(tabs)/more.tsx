import React from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
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
import { Screen, T, Row } from "../../components/ui";
import { useTheme } from "../../theme";
import { hasPermission, useSession } from "../../store/session";
export default function More() {
  const c = useTheme(),
    owner = useSession((s) => s.user?.role === "owner");
  const { width } = useWindowDimensions();
  const tones = [
    { color: c.blue, background: c.blueSoft },
    { color: c.violet, background: c.violetSoft },
    { color: c.success, background: c.successSoft },
    { color: c.warning, background: c.warningSoft },
    { color: c.danger, background: c.dangerSoft },
  ];
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
      label: "Security & sessions",
      detail: "Review signed-in devices",
      path: "/security",
      icon: Shield,
      show: true,
    },
    {
      label: "Appearance & language",
      detail: "Make TamilTrade yours",
      path: "/settings",
      icon: Settings,
      show: true,
    },
  ];
  return (
    <Screen
      title="Your business toolkit"
      subtitle="Everything you need to keep moving."
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {items
          .filter((i) => i.show)
          .map((item, i) => (
            <Pressable
              key={item.path}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => router.push(item.path as Href)}
              style={{
                flexBasis: width >= 750 ? "45%" : "100%",
                flexGrow: 1,
                padding: 18,
                borderBottomWidth: 1,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 20,
                backgroundColor: c.surface,
              }}
            >
              <Row>
                <View
                  style={{
                    backgroundColor: tones[i % tones.length]!.background,
                    padding: 11,
                    borderRadius: 13,
                  }}
                >
                  <item.icon color={tones[i % tones.length]!.color} size={21} />
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
      </View>
      <T size={11} color={c.muted} style={{ textAlign: "center" }}>
        TAMILTRADE AI · SPEAK NATURALLY. TRADE SMARTER.
      </T>
    </Screen>
  );
}
