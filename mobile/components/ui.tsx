import React, { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Inbox,
  Search,
  X,
  AlertCircle,
  TrendingUp,
} from "lucide-react-native";
import { router } from "expo-router";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { selectionFeedback } from "../services/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { rupees, type TradeRecord } from "@tamiltrade/shared";
import { useTheme } from "../theme";
import { AppModal as Modal } from "./app-modal";
import { AssistantBackground } from "./assistant-background";
import { StoreIcon } from "./store-icon";
import { STORE_NAME } from "../config/brand";
export function T({
  children,
  size = 14,
  color,
  weight = "regular",
  style,
  ...rest
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  weight?: "regular" | "medium" | "bold";
  style?: object;
  accessibilityRole?: "header";
  accessibilityLiveRegion?: "polite" | "assertive";
}) {
  const c = useTheme();
  const tamil = React.Children.toArray(children).some(
    (child) => typeof child === "string" && /[\u0b80-\u0bff]/.test(child),
  );
  return (
    <Text
      {...rest}
      style={[
        {
          color: color ?? c.text,
          fontSize: size,
          lineHeight: size * 1.5,
          fontFamily: tamil
            ? "Tamil"
            : weight === "bold"
              ? "InterBold"
              : weight === "medium"
                ? "InterMedium"
                : "Inter",
          fontVariant: ["tabular-nums"],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const c = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 18,
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Row({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  busy = false,
  variant = "primary",
  icon,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  variant?: "primary" | "secondary" | "danger";
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const c = useTheme();
  const foreground =
    variant === "primary"
      ? c.accentText
      : variant === "danger"
        ? c.danger
        : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: busy || disabled, busy }}
      disabled={busy || disabled}
      onPress={() => {
        void selectionFeedback();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 13,
        backgroundColor: variant === "primary" ? c.accent : "transparent",
        borderWidth: variant === "primary" ? 0 : 1,
        borderColor: variant === "danger" ? c.danger : c.border,
        opacity: busy || disabled ? 0.6 : pressed ? 0.8 : 1,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 10,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {busy ? <ActivityIndicator color={foreground} /> : icon}
      <T weight="medium" color={foreground}>
        {busy ? "Please wait…" : title}
      </T>
    </Pressable>
  );
}
export function BackButton() {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => {
        void selectionFeedback();
        router.back();
      }}
      style={({ pressed }) => ({
        alignSelf: "flex-start",
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 10,
        backgroundColor: pressed ? c.elevated : "transparent",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <ArrowLeft size={16} color={c.text} />
      <T size={13} weight="medium">
        Back
      </T>
    </Pressable>
  );
}
export function AppBrand() {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <StoreIcon />
      <T size={15} weight="bold" style={{ flexShrink: 1, lineHeight: 20 }}>
        {STORE_NAME}
      </T>
    </View>
  );
}
export function Screen({
  title,
  subtitle,
  children,
  back = false,
  action,
  refreshing,
  onRefresh,
  maxWidth = 960,
  variant = "default",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: boolean;
  action?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  maxWidth?: number;
  variant?: "default" | "assistant";
}) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      {variant === "assistant" && <AssistantBackground />}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: width < 360 ? 16 : width < 600 ? 20 : 32,
            paddingBottom: 40,
            gap: 20,
            ...(variant === "assistant" ? { paddingTop: 18 } : {}),
            width: "100%",
            maxWidth,
            alignSelf: "center",
          }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing ?? false}
                onRefresh={onRefresh}
                tintColor={c.accent}
              />
            ) : undefined
          }
        >
          <Row style={{ gap: 12 }}>
            {back ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={() => router.back()}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  justifyContent: "center",
                }}
              >
                <ArrowLeft color={c.text} />
              </Pressable>
            ) : (
              <AppBrand />
            )}
            {action ?? (
              <T
                size={11}
                color={c.muted}
                weight="bold"
                style={{ letterSpacing: 1.6 }}
              >
                WORKSPACE
              </T>
            )}
          </Row>
          <View
            style={{
              gap: 7,
              alignItems: variant === "assistant" ? "center" : undefined,
            }}
          >
            <T
              size={width < 600 ? 25 : 30}
              weight="bold"
              accessibilityRole="header"
              style={{
                letterSpacing: -0.7,
                textAlign: variant === "assistant" ? "center" : undefined,
              }}
            >
              {title}
            </T>
            {!!subtitle && (
              <T
                color={c.muted}
                size={13}
                style={{
                  textAlign: variant === "assistant" ? "center" : undefined,
                }}
              >
                {subtitle}
              </T>
            )}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Field({
  label,
  error,
  hint,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <T size={12} color={c.muted} weight="medium">
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={[
          {
            minHeight: 52,
            backgroundColor: c.bg,
            borderWidth: 1,
            borderColor: error ? c.danger : c.border,
            borderRadius: 14,
            padding: 14,
            color: c.text,
            fontFamily: "Inter",
            fontSize: 15,
          },
          props.style,
        ]}
      />
      {error ? (
        <T size={12} color={c.danger} accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : hint ? (
        <T size={12} color={c.muted}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}
export function ErrorNotice({
  error,
  retry,
  retryDisabled = false,
  retryLabel = "Try again",
}: {
  error: unknown;
  retry?: () => void;
  retryDisabled?: boolean;
  retryLabel?: string;
}) {
  const c = useTheme();
  if (!error) return null;
  return (
    <Card style={{ borderColor: c.danger }}>
      <Row>
        <AlertCircle color={c.danger} size={20} />
        <View style={{ flex: 1 }}>
          <T color={c.danger} accessibilityLiveRegion="assertive">
            {error instanceof Error ? error.message : String(error)}
          </T>
        </View>
      </Row>
      {retry && (
        <Button
          title={retryLabel}
          variant="secondary"
          disabled={retryDisabled}
          onPress={retry}
        />
      )}
    </Card>
  );
}
export function EmptyState({
  title = "No records yet",
  description = "Your business records will appear here.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  const c = useTheme();
  return (
    <Card style={{ alignItems: "center", paddingVertical: 32 }}>
      <View
        style={{
          backgroundColor: c.soft,
          padding: 16,
          borderRadius: 20,
          marginBottom: 4,
        }}
      >
        <Inbox size={25} color={c.accent} />
      </View>
      <T size={17} weight="bold">
        {title}
      </T>
      <T color={c.muted} style={{ textAlign: "center", maxWidth: 290 }}>
        {description}
      </T>
      {action}
    </Card>
  );
}
export function LoadingSkeleton() {
  const c = useTheme();
  return (
    <View
      accessibilityLabel="Loading business records"
      accessibilityLiveRegion="polite"
      style={{ gap: 16 }}
    >
      {[120, 70, 70].map((h, i) => (
        <View
          key={i}
          style={{
            height: h,
            backgroundColor: c.elevated,
            borderRadius: 22,
            opacity: 0.7,
          }}
        />
      ))}
    </View>
  );
}
export function PaymentStatusChip({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "success" | "warning" | "danger";
}) {
  const c = useTheme();
  return (
    <View
      style={{
        backgroundColor:
          tone === "success"
            ? c.successSoft
            : tone === "warning"
              ? c.warningSoft
              : tone === "danger"
                ? c.dangerSoft
                : c.elevated,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        alignSelf: "flex-start",
      }}
    >
      <T
        size={10}
        color={
          tone === "success"
            ? c.success
            : tone === "warning"
              ? c.warning
              : tone === "danger"
                ? c.danger
                : c.muted
        }
        weight="medium"
      >
        {label}
      </T>
    </View>
  );
}
export function PremiumBalanceCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
  caption: string;
}) {
  const { width } = useWindowDimensions();
  const c = useTheme();
  return (
    <LinearGradient
      colors={["#164C3B", "#123E32", "#15362F"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        padding: width < 600 ? 24 : 30,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: c.border,
        gap: 15,
        overflow: "hidden",
        minHeight: 180,
        justifyContent: "space-between",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: 110,
          borderWidth: 32,
          borderColor: "#FFFFFF10",
          right: -70,
          top: -85,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: "#FFFFFF08",
          right: -30,
          bottom: -115,
        }}
      />
      <Row>
        <T color="#FFFFFF" size={12} weight="medium">
          {label}
        </T>
        <View
          style={{ padding: 8, borderRadius: 12, backgroundColor: "#FFFFFF20" }}
        >
          <TrendingUp size={20} color="#FFFFFF" />
        </View>
      </Row>
      <T
        color="#FFFFFF"
        size={width < 600 ? 34 : 42}
        weight="bold"
        style={{ letterSpacing: -1.2 }}
      >
        {rupees(value)}
      </T>
      <View style={{ height: 1, backgroundColor: "#FFFFFF30" }} />
      <T size={12} color="#FFFFFF">
        {caption}
      </T>
    </LinearGradient>
  );
}
export function FinancialMetricCard({
  label,
  value,
  unit = false,
  tone = "blue",
  icon,
}: {
  label: string;
  value: number;
  unit?: boolean;
  tone?: "mint" | "blue" | "amber" | "coral" | "violet";
  icon?: ReactNode;
}) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const formattedValue = unit ? String(value) : rupees(value);
  const tones = {
    mint: [c.success, c.successSoft],
    blue: [c.blue, c.blueSoft],
    amber: [c.warning, c.warningSoft],
    coral: [c.danger, c.dangerSoft],
    violet: [c.violet, c.violetSoft],
  };
  const [color, background] = tones[tone];
  return (
    <Card
      style={{
        flex: 1,
        padding: 18,
        minWidth: 0,
        minHeight: 148,
        gap: 12,
        backgroundColor: background,
        borderColor: background,
      }}
    >
      <View
        style={{
          alignSelf: "flex-start",
          padding: 7,
          borderRadius: 11,
          backgroundColor: c.surface,
        }}
      >
        {icon ?? <TrendingUp size={17} color={color} />}
      </View>
      <T size={11} color={c.muted} weight="medium">
        {label}
      </T>
      <T
        size={
          formattedValue.length > 13
            ? 16
            : width < 600 && formattedValue.length > 10
              ? 17
              : 21
        }
        weight="bold"
        color={c.text}
      >
        {formattedValue}
      </T>
    </Card>
  );
}
export function TransactionRow({
  item,
  onPress,
  compact = false,
}: {
  item: TradeRecord;
  onPress?: () => void;
  compact?: boolean;
}) {
  const c = useTheme();
  const income = item.kind === "sale" || item.kind === "customer_payment";
  const color = income
    ? c.success
    : item.kind === "expense"
      ? c.danger
      : c.blue;
  const background = income
    ? c.successSoft
    : item.kind === "expense"
      ? c.dangerSoft
      : c.blueSoft;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.kind} ${item.contactName ?? item.category} ${rupees(item.total)}`}
      onPress={
        onPress ??
        (() =>
          router.push({ pathname: "/records/[id]", params: { id: item._id } }))
      }
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: compact ? 0 : 14,
        borderWidth: compact ? 0 : 1,
        borderBottomWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
        borderRadius: compact ? 0 : 16,
        marginBottom: compact ? 0 : 10,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Row>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            backgroundColor: background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowUpRight
            color={color}
            style={{ transform: [{ rotate: income ? "0deg" : "180deg" }] }}
            size={20}
          />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <T weight="medium">{item.contactName ?? item.category}</T>
          <T size={11} color={c.muted}>
            {item.kind.replaceAll("_", " ")} · {item.date}
          </T>
        </View>
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <T weight="bold" color={income ? c.success : c.text}>
            {rupees(item.total)}
          </T>
          <T size={10} color={c.muted}>
            {item.status === "reversed"
              ? "REVERSED"
              : item.kind === "sale" || item.kind === "purchase"
                ? item.paid >= item.total
                  ? "PAID"
                  : item.paid
                    ? "PART PAID"
                    : "UNPAID"
                : item.method?.toUpperCase()}
          </T>
        </View>
      </Row>
    </Pressable>
  );
}
export function Select({
  label,
  value,
  options,
  onChange,
  error,
  onLoadMore,
  hasMore = false,
  loading = false,
  onCreate,
  createLabel,
}: {
  label: string;
  value?: string;
  options: { value: string; label: string; detail?: string }[];
  onChange: (v: string) => void;
  error?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  onCreate?: () => void;
  createLabel?: string;
}) {
  const c = useTheme();
  const [visible, setVisible] = useState(false),
    [search, setSearch] = useState("");
  return (
    <View style={{ gap: 7 }}>
      <T size={12} color={c.muted}>
        {label}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          setSearch("");
          setVisible(true);
        }}
        style={{
          minHeight: 52,
          padding: 14,
          backgroundColor: c.elevated,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: error ? c.danger : c.border,
        }}
      >
        <Row>
          <View style={{ flex: 1 }}>
            <T>{options.find((o) => o.value === value)?.label ?? "Choose…"}</T>
          </View>
          <ChevronDown size={18} color={c.muted} />
        </Row>
      </Pressable>
      {error && (
        <T size={12} color={c.danger}>
          {error}
        </T>
      )}
      <Modal
        accessibilityLabel={label}
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: c.bg, padding: 24, gap: 16 }}
        >
          <Row>
            <T size={22} weight="bold">
              {label}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close selection"
              onPress={() => setVisible(false)}
              style={{ padding: 12 }}
            >
              <X color={c.text} />
            </Pressable>
          </Row>
          <Field
            label="Search options"
            value={search}
            onChangeText={setSearch}
          />
          {onCreate && (
            <Button
              title={createLabel ?? "Add new"}
              variant="secondary"
              onPress={() => {
                setVisible(false);
                onCreate();
              }}
            />
          )}
          <FlatList
            ListFooterComponent={
              hasMore ? (
                <Button
                  title="Load more options"
                  busy={loading}
                  variant="secondary"
                  onPress={() => onLoadMore?.()}
                />
              ) : undefined
            }
            data={options.filter((o) =>
              o.label.toLowerCase().includes(search.toLowerCase()),
            )}
            keyExtractor={(o) => o.value}
            ListEmptyComponent={
              <EmptyState
                title="No matching options"
                description="Add the required contact, product or source transaction first."
              />
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange(item.value);
                  setVisible(false);
                }}
                style={{
                  paddingVertical: 18,
                  borderBottomWidth: 1,
                  borderColor: c.border,
                }}
              >
                <Row>
                  <View style={{ flex: 1 }}>
                    <T weight="medium">{item.label}</T>
                    {item.detail && (
                      <T size={12} color={c.muted}>
                        {item.detail}
                      </T>
                    )}
                  </View>
                  {value === item.value && <Check color={c.accent} />}
                </Row>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
export { ModernDatePicker } from "./date-picker";
export function ConfirmationSheet({
  visible,
  children,
  onClose,
}: {
  visible: boolean;
  children: ReactNode;
  onClose: () => void;
}) {
  const c = useTheme();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  return (
    <Modal
      accessibilityLabel="Review and confirm transaction"
      visible={visible}
      transparent
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#0009",
          justifyContent: width >= 760 ? "center" : "flex-end",
        }}
      >
        <View
          style={{
            maxHeight: "90%",
            width: "100%",
            maxWidth: 680,
            alignSelf: "center",
            backgroundColor: c.bg,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            borderBottomLeftRadius: width >= 760 ? 24 : 0,
            borderBottomRightRadius: width >= 760 ? 24 : 0,
            padding: 24,
            gap: 20,
            paddingBottom: 40,
          }}
        >
          <Row>
            <T size={23} weight="bold">
              Review & confirm
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close preview"
              onPress={onClose}
              style={{ padding: 12 }}
            >
              <X color={c.muted} />
            </Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ gap: 18 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
