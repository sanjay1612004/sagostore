import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Pressable } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  type Contact,
  type Product,
  type TradeInput,
  type Draft,
  type TradeRecord,
  tradeSchema,
  indiaDate,
  rupees,
} from "@tamiltrade/shared";
import {
  api,
  post,
  newKey,
  invalidateBusiness,
  ApiError,
} from "../services/api";
import { useOptions } from "../services/options";
import { useComposer, useTradeSelection } from "../store/composer";
import { hasPermission } from "../store/session";
import { FormDetails } from "../components/form-details";
import {
  tradeDefaults,
  soleChoice,
  eligibleSources,
} from "../services/trade-defaults";
import {
  Screen,
  T,
  Card,
  Field,
  Select,
  Button,
  Row,
  ErrorNotice,
  ConfirmationSheet,
  ModernDatePicker,
} from "../components/ui";
import { useTheme } from "../theme";
type Values = {
  contactId: string;
  productId: string;
  sourceId: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  transport: string;
  loading: string;
  unloading: string;
  otherCosts: string;
  discount: string;
  taxBps: string;
  date: string;
  dueDate: string;
  method: "cash" | "upi" | "bank" | "cheque";
  category: string;
  reference: string;
  notes: string;
  delivery: "warehouse" | "direct";
};
export default function Trade() {
  const c = useTheme();
  const params = useLocalSearchParams<{ kind: TradeInput["kind"] }>();
  const [incoming] = useState(() => {
    const input = useComposer.getState().input;
    useComposer.getState().set(null);
    return input;
  });
  const [kind, setKind] = useState<TradeInput["kind"]>(
    incoming?.kind ?? params.kind ?? "purchase",
  );
  const isTrade = kind === "sale" || kind === "purchase",
    payment = kind.endsWith("payment");
  const contactKind =
    kind === "purchase" || kind === "supplier_payment"
      ? "supplier"
      : "customer";
  const {
    control,
    watch,
    handleSubmit,
    setError,
    setValue,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    defaultValues: tradeDefaults(incoming, indiaDate()),
  });
  const contactId = watch("contactId"),
    productId = watch("productId"),
    delivery = watch("delivery"),
    sourceId = watch("sourceId");
  const values = watch();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const extras = [
    "transport",
    "loading",
    "unloading",
    "otherCosts",
    "discount",
    "taxBps",
  ] as const;
  const detailFields = [
    ...extras,
    "date",
    "dueDate",
    "reference",
    "notes",
    "delivery",
  ] as const;
  const detailsHaveErrors = detailFields.some((key) => !!errors[key]);
  useEffect(() => {
    if (detailsHaveErrors) setDetailsOpen(true);
  }, [detailsHaveErrors]);
  const detailsVisible = detailsOpen || detailsHaveErrors;
  const detailsSummary = [
    values.date === indiaDate() ? "Today" : values.date,
    isTrade
      ? delivery === "warehouse"
        ? "Warehouse"
        : "Direct delivery"
      : undefined,
    isTrade
      ? extras.some((key) => Number(values[key]) !== 0)
        ? "Charges / tax added"
        : "No extra charges or tax"
      : undefined,
    values.dueDate ? `Due ${values.dueDate}` : undefined,
    values.reference ? `Ref: ${values.reference}` : undefined,
    values.notes ? "Note added" : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  const change = (name: keyof Values, value: string) => {
    if (name === "productId" && productId && productId !== value) {
      setValue("quantity", "");
      setValue("unitPrice", "");
    }
    if (
      payment &&
      ((name === "contactId" && contactId !== value) ||
        (name === "sourceId" && sourceId && sourceId !== value))
    )
      setValue("amount", "");
    setValue(name, value, { shouldDirty: true });
    clearErrors(name);
    if (
      name === "productId" ||
      name === "delivery" ||
      (name === "contactId" && payment)
    ) {
      setValue("sourceId", "");
      clearErrors("sourceId");
    }
  };
  useFocusEffect(
    useCallback(() => {
      const selection = useTradeSelection.getState().selection;
      if (selection) {
        if (
          selection.field === "productId" &&
          getValues("productId") &&
          getValues("productId") !== selection.id
        ) {
          setValue("quantity", "");
          setValue("unitPrice", "");
        }
        setValue(selection.field, selection.id, { shouldDirty: true });
        clearErrors(selection.field);
        if (selection.field === "productId" || payment)
          setValue("sourceId", "");
        if (selection.field === "contactId" && payment) setValue("amount", "");
        useTradeSelection.getState().set(null);
      }
    }, [setValue, getValues, clearErrors, payment]),
  );
  const [error, setFailure] = useState<unknown>(),
    [draft, setDraft] = useState<Draft | null>(null),
    [saving, setSaving] = useState(false),
    [confirmError, setConfirmError] = useState<unknown>();
  const keyRef = useRef({ body: "", key: newKey() });
  const contacts = useOptions<Contact>(
    ["contacts", contactKind, "options"],
    `/api/contacts?kind=${contactKind}`,
    kind !== "expense",
  );
  const products = useOptions<Product>(["products"], "/api/products", isTrade);
  const sources = useOptions<TradeRecord>(
    ["sources", kind, contactId, productId],
    kind === "sale"
      ? `/api/inventory?productId=${productId}`
      : `/api/records?kind=${kind === "customer_payment" ? "sale" : "purchase"}&contactId=${contactId}`,
    (kind === "sale" && !!productId) || (payment && !!contactId),
  );
  const selectedContact = useQuery({
    queryKey: ["contact", contactId],
    queryFn: () => api<Contact>(`/api/contacts/${contactId}`),
    enabled: !!contactId && !contacts.items.some((p) => p._id === contactId),
  });
  const selectedSource = useQuery({
    queryKey: ["record", sourceId],
    queryFn: () => api<TradeRecord>(`/api/records/${sourceId}`),
    enabled:
      !!sourceId &&
      sourceId === incoming?.sourceId &&
      sources.isSuccess &&
      !sources.isFetching &&
      hasPermission(kind === "customer_payment" ? "sales" : "purchases") &&
      !sources.items.some((p) => p._id === sourceId),
  });
  const sourceItems =
    selectedSource.data &&
    !sources.items.some((p) => p._id === selectedSource.data._id)
      ? [...sources.items, selectedSource.data]
      : sources.items;
  const eligible = eligibleSources(
    sourceItems,
    kind,
    contactId,
    productId,
    delivery,
  );
  const allocatedSource = eligible.find((s) => s._id === sourceId);
  useEffect(() => {
    // An explicit lot can be on a later page. Load it through the permitted
    // inventory listing when a staff member cannot open purchase records.
    if (
      kind === "sale" &&
      sourceId &&
      sourceId === incoming?.sourceId &&
      !hasPermission("purchases") &&
      sources.isSuccess &&
      sources.hasNextPage &&
      !sources.isFetching &&
      !sources.items.some((s) => s._id === sourceId)
    ) {
      sources.more();
    }
  }, [
    kind,
    sourceId,
    incoming?.sourceId,
    sources.data,
    sources.isFetching,
    sources.hasNextPage,
  ]);
  const product = products.items.find((p) => p._id === productId);
  const contactItems =
    selectedContact.data &&
    !contacts.items.some((p) => p._id === selectedContact.data._id)
      ? [...contacts.items, selectedContact.data]
      : contacts.items;
  useEffect(() => {
    const defaults: [
      "contactId" | "productId" | "sourceId",
      string | undefined,
    ][] = [
      [
        "contactId",
        kind === "expense"
          ? undefined
          : soleChoice(
              contacts.items,
              contacts.isSuccess &&
                !contacts.hasNextPage &&
                !contacts.isFetching,
              getValues("contactId"),
            ),
      ],
      [
        "productId",
        isTrade
          ? soleChoice(
              products.items,
              products.isSuccess &&
                !products.hasNextPage &&
                !products.isFetching,
              getValues("productId"),
            )
          : undefined,
      ],
      [
        "sourceId",
        soleChoice(
          eligible,
          sources.isSuccess && !sources.hasNextPage && !sources.isFetching,
          getValues("sourceId"),
        ),
      ],
    ];
    for (const [field, value] of defaults)
      if (value) {
        setValue(field, value);
        clearErrors(field);
      }
  }, [
    contacts.data,
    contacts.isFetching,
    products.data,
    products.isFetching,
    sources.data,
    sources.isFetching,
    kind,
    contactId,
    productId,
    delivery,
    getValues,
    setValue,
    clearErrors,
  ]);
  const choosePaymentKind = (next: TradeInput["kind"]) => {
    if (next === kind) return;
    setKind(next);
    for (const field of [
      "contactId",
      "sourceId",
      "amount",
      "reference",
      "notes",
    ] as const)
      setValue(field, "");
    clearErrors();
    setFailure(undefined);
  };
  const addContact = () => {
    useTradeSelection.getState().set(null);
    router.push({
      pathname: "/contact-form",
      params: { kind: contactKind, returnTo: "trade" },
    });
  };
  const addProduct = () => {
    useTradeSelection.getState().set(null);
    router.push({ pathname: "/product-form", params: { returnTo: "trade" } });
  };
  const textField = (
    name: keyof Values,
    label: string,
    opts: { numeric?: boolean; hint?: string } = {},
  ) => (
    <Controller
      key={name}
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur } }) => (
        <Field
          label={label}
          value={value}
          onChangeText={(value) => {
            onChange(value);
            clearErrors(name);
          }}
          onBlur={onBlur}
          error={errors[name]?.message}
          placeholder={
            name === "quantity"
              ? "Enter quantity"
              : name === "unitPrice"
                ? "Enter unit price"
                : name === "amount"
                  ? "Enter amount"
                  : undefined
          }
          keyboardType={opts.numeric ? "decimal-pad" : "default"}
          hint={opts.hint}
        />
      )}
    />
  );
  const submit = handleSubmit(async (values) => {
    setFailure(undefined);
    clearErrors();
    const input = tradeSchema.safeParse({
      ...values,
      kind,
      contactId: values.contactId || undefined,
      productId: values.productId || undefined,
      sourceId: values.sourceId || undefined,
      quantity: values.quantity ? Number(values.quantity) : undefined,
      unitPrice: values.unitPrice || undefined,
      amount: values.amount || undefined,
      taxBps: Math.round(Number(values.taxBps) * 100),
      dueDate: values.dueDate || undefined,
    });
    if (!input.success) {
      for (const issue of input.error.issues)
        setError(issue.path[0] as keyof Values, {
          message:
            issue.code === "custom" && issue.message.endsWith(" is required")
              ? ({
                  contactId: `Choose a ${contactKind}.`,
                  productId: "Choose a product.",
                  sourceId: payment
                    ? "Choose the transaction to pay."
                    : "Choose a source purchase lot.",
                  quantity: "Enter a quantity.",
                  unitPrice: "Enter the price per unit.",
                  amount: "Enter an amount.",
                }[String(issue.path[0])] ?? issue.message)
              : issue.path[0] === "taxBps"
                ? "Enter a tax rate between 0% and 100%."
                : issue.message,
        });
      setFailure(new Error("Check the highlighted fields, then review again."));
      return;
    }
    const body = JSON.stringify(input.data);
    if (keyRef.current.body !== body) keyRef.current = { body, key: newKey() };
    try {
      setConfirmError(undefined);
      setDraft(
        await post<Draft>("/api/drafts", input.data, keyRef.current.key),
      );
    } catch (e) {
      if (e instanceof ApiError)
        for (const issue of e.fields)
          setError(issue.field as keyof Values, { message: issue.message });
      setFailure(e);
    }
  });
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setConfirmError(undefined);
    try {
      const result = await post<TradeRecord>(
        `/api/drafts/${draft._id}/confirm`,
        { confirm: true },
      );
      await invalidateBusiness();
      useComposer.getState().set(null);
      setDraft(null);
      router.replace({ pathname: "/records/[id]", params: { id: result._id } });
    } catch (e) {
      setConfirmError(e);
    } finally {
      setSaving(false);
    }
  };
  const edit = async () => {
    if (saving || !draft) return;
    setSaving(true);
    setConfirmError(undefined);
    try {
      await api(`/api/drafts/${draft._id}`, { method: "DELETE" });
      keyRef.current = { body: "", key: newKey() };
      setDraft(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === "DRAFT_ALREADY_CONFIRMED") {
        try {
          const saved = await api<Draft>(`/api/drafts/${draft._id}`);
          if (saved.recordId) {
            await invalidateBusiness();
            setDraft(null);
            router.replace({
              pathname: "/records/[id]",
              params: { id: saved.recordId },
            });
            return;
          }
        } catch (lookupError) {
          setConfirmError(lookupError);
          return;
        }
      }
      setConfirmError(e);
    } finally {
      setSaving(false);
    }
  };
  const contactOptions =
    contactItems.map((p) => ({
      value: p._id,
      label: p.name,
      detail: `Outstanding ${rupees(p.balance)}`,
    })) ?? [];
  const sourceOptions =
    eligible.map((s) => ({
      value: s._id,
      label: `${s.date} · ${s.contactName}`,
      detail:
        kind === "sale"
          ? `${s.quantity! - s.allocatedQuantity} available · ${s.productName} · ${s.delivery}`
          : `${rupees(s.total - s.paid)} outstanding · ${s.productName}`,
    })) ?? [];
  return (
    <Screen
      title={payment ? "Record a payment" : `New ${kind}`}
      subtitle="Fill the essentials, review once, then save."
      back
      maxWidth={760}
    >
      <ErrorNotice error={error} />
      <ErrorNotice
        error={
          contacts.error ??
          products.error ??
          sources.error ??
          selectedContact.error ??
          (sources.items.some((s) => s._id === sourceId)
            ? undefined
            : selectedSource.error)
        }
        retry={() => {
          if (kind !== "expense") void contacts.refetch();
          if (isTrade) void products.refetch();
          if ((kind === "sale" && productId) || (payment && contactId))
            void sources.refetch();
          if (selectedContact.isError) void selectedContact.refetch();
          if (selectedSource.isError) void selectedSource.refetch();
        }}
      />
      {payment && (
        <Row>
          {(
            [
              {
                kind: "customer_payment",
                label: "Receive",
                detail: "From customer",
                accessible: "Receive from customer",
              },
              {
                kind: "supplier_payment",
                label: "Pay",
                detail: "To supplier",
                accessible: "Pay supplier",
              },
            ] as const
          ).map((option) => (
            <Pressable
              key={option.kind}
              accessibilityRole="button"
              accessibilityLabel={option.accessible}
              aria-pressed={kind === option.kind}
              accessibilityState={{ selected: kind === option.kind }}
              onPress={() => choosePaymentKind(option.kind)}
              style={{
                flex: 1,
                minHeight: 70,
                borderRadius: 16,
                padding: 12,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                backgroundColor: kind === option.kind ? c.accent : c.elevated,
                borderWidth: 1,
                borderColor: kind === option.kind ? c.accent : c.border,
              }}
            >
              <T
                weight="bold"
                color={kind === option.kind ? c.accentText : c.text}
              >
                {option.label}
              </T>
              <T
                size={11}
                color={kind === option.kind ? c.accentText : c.muted}
              >
                {option.detail}
              </T>
            </Pressable>
          ))}
        </Row>
      )}
      <Card>
        <T size={18} weight="bold">
          {payment ? "Payment details" : "Transaction details"}
        </T>
        {kind !== "expense" && (
          <>
            <Controller
              control={control}
              name="contactId"
              render={({ field }) => (
                <Select
                  label={contactKind === "supplier" ? "Supplier" : "Customer"}
                  value={field.value}
                  onChange={(value) => change("contactId", value)}
                  options={contactOptions}
                  hasMore={contacts.hasNextPage}
                  onLoadMore={contacts.more}
                  loading={contacts.isFetching}
                  error={errors.contactId?.message}
                  onCreate={hasPermission("contacts") ? addContact : undefined}
                  createLabel={`New ${contactKind}`}
                />
              )}
            />
            {hasPermission("contacts") &&
              contacts.isSuccess &&
              !contacts.items.length && (
                <Button
                  title={`New ${contactKind}`}
                  variant="secondary"
                  onPress={addContact}
                />
              )}
          </>
        )}
        {isTrade && (
          <>
            <Controller
              control={control}
              name="productId"
              render={({ field }) => (
                <Select
                  label="Product"
                  value={field.value}
                  onChange={(value) => change("productId", value)}
                  options={products.items.map((p) => ({
                    value: p._id,
                    label: `${p.name} · ${p.unit}`,
                  }))}
                  hasMore={products.hasNextPage}
                  onLoadMore={products.more}
                  loading={products.isFetching}
                  error={errors.productId?.message}
                  onCreate={hasPermission("contacts") ? addProduct : undefined}
                  createLabel="New product"
                />
              )}
            />
            {hasPermission("contacts") &&
              products.isSuccess &&
              !products.items.length && (
                <Button
                  title="New product"
                  variant="secondary"
                  onPress={addProduct}
                />
              )}
          </>
        )}
        {(kind === "sale" || payment) && (
          <>
            <Controller
              control={control}
              name="sourceId"
              render={({ field }) => (
                <Select
                  label={payment ? "Transaction to pay" : "Source purchase lot"}
                  value={field.value}
                  onChange={(value) => change("sourceId", value)}
                  options={sourceOptions}
                  hasMore={sources.hasNextPage}
                  onLoadMore={sources.more}
                  loading={sources.isFetching}
                  error={errors.sourceId?.message}
                />
              )}
            />
            {allocatedSource ? (
              <T size={12} color={c.muted} accessibilityLiveRegion="polite">
                {payment
                  ? `${rupees(allocatedSource.total - allocatedSource.paid)} remaining. Enter a partial amount or use the full balance.`
                  : `${allocatedSource.quantity! - allocatedSource.allocatedQuantity} units available · ${allocatedSource.delivery}. Check this lot before saving.`}
              </T>
            ) : (
              <T size={12} color={c.muted}>
                {payment
                  ? "Choose an account to see its unpaid transactions."
                  : "Choose a product to see available lots. Change delivery under More options for direct lots."}
              </T>
            )}
          </>
        )}
        {((contacts.items.length === 1 &&
          !contacts.hasNextPage &&
          contactId === contacts.items[0]?._id) ||
          (isTrade &&
            products.items.length === 1 &&
            !products.hasNextPage &&
            productId === products.items[0]?._id)) && (
          <T size={12} color={c.muted}>
            Single available options are preselected. Tap a field to change it.
          </T>
        )}
        {isTrade && (
          <>
            {textField(
              "quantity",
              `Quantity${product ? ` · ${product.unit}` : " · whole units"}`,
              { numeric: true },
            )}
            {textField(
              "unitPrice",
              `Price per ${product?.unit ?? "unit"} · ₹`,
              { numeric: true },
            )}
          </>
        )}
        {!isTrade && textField("amount", "Amount · ₹", { numeric: true })}
        {payment && allocatedSource && (
          <Button
            title={`Use full balance · ${rupees(allocatedSource.total - allocatedSource.paid)}`}
            variant="secondary"
            onPress={() =>
              change(
                "amount",
                ((allocatedSource.total - allocatedSource.paid) / 100).toFixed(
                  2,
                ),
              )
            }
          />
        )}
        {payment && (
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select
                label="Payment method"
                value={field.value}
                onChange={field.onChange}
                options={["cash", "upi", "bank", "cheque"].map((v) => ({
                  value: v,
                  label: v.toUpperCase(),
                }))}
              />
            )}
          />
        )}
        {kind === "expense" && textField("category", "Expense category")}
      </Card>
      <FormDetails
        summary={detailsSummary}
        open={detailsVisible}
        onToggle={() => setDetailsOpen(!detailsVisible)}
      >
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <ModernDatePicker
              label="Transaction date"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {!!errors.date && <T color={c.danger}>{errors.date.message}</T>}
        {isTrade && (
          <>
            <Controller
              control={control}
              name="delivery"
              render={({ field }) => (
                <Select
                  label="Delivery"
                  value={field.value}
                  onChange={(value) => change("delivery", value)}
                  options={[
                    { value: "warehouse", label: "Warehouse" },
                    { value: "direct", label: "Direct mill-to-customer" },
                  ]}
                />
              )}
            />
            <T weight="bold">Charges & adjustments · optional</T>
            {textField(
              "transport",
              kind === "purchase"
                ? "Transport cost · ₹"
                : "Transport billed to customer · ₹",
              { numeric: true },
            )}
            {textField("loading", "Loading · ₹", { numeric: true })}
            {textField("unloading", "Unloading · ₹", { numeric: true })}
            {textField("otherCosts", "Other costs · ₹", { numeric: true })}
            {textField("discount", "Discount · ₹", { numeric: true })}
            {textField("taxBps", "Tax rate · %", {
              numeric: true,
              hint: "Change 0% if this transaction is taxable.",
            })}
            <Controller
              control={control}
              name="dueDate"
              render={({ field }) => (
                <ModernDatePicker
                  label="Payment due date · optional"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {!!errors.dueDate && (
              <T color={c.danger}>{errors.dueDate.message}</T>
            )}
          </>
        )}
        {textField("reference", "Reference / invoice number · optional")}
        {textField("notes", "Notes · optional")}
      </FormDetails>
      <Button
        title="Review transaction"
        busy={isSubmitting}
        onPress={() => void submit()}
      />
      <T size={12} color={c.muted} style={{ textAlign: "center" }}>
        Nothing is saved until you confirm the review.
      </T>
      <ConfirmationSheet visible={!!draft} onClose={edit}>
        {draft && (
          <>
            <T color={c.muted}>
              Please check the account, quantity, price and allocation before
              saving.
            </T>
            <Card>
              <Row>
                <T>Type</T>
                <T weight="bold">{draft.input.kind.replaceAll("_", " ")}</T>
              </Row>
              {contactId && (
                <Row>
                  <T>Account</T>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <T weight="bold">
                      {contactOptions.find((p) => p.value === contactId)?.label}
                    </T>
                  </View>
                </Row>
              )}
              {isTrade && (
                <>
                  <Row>
                    <T>Product</T>
                    <T weight="bold">
                      {product?.name ??
                        allocatedSource?.productName ??
                        "Selected product"}
                    </T>
                  </Row>
                  <Row>
                    <T>Quantity</T>
                    <T>{draft.input.quantity}</T>
                  </Row>
                  <Row>
                    <T>Unit price</T>
                    <T>₹{draft.input.unitPrice}</T>
                  </Row>
                </>
              )}
              {allocatedSource && (
                <View style={{ gap: 4 }}>
                  <T weight="bold">{payment ? "Applied to" : "Source lot"}</T>
                  <T>
                    {allocatedSource.date} · {allocatedSource.contactName} ·{" "}
                    {allocatedSource.productName}
                  </T>
                  <T size={12} color={c.muted}>
                    Transaction {allocatedSource._id}
                  </T>
                </View>
              )}
              {isTrade && (
                <>
                  <Row>
                    <T>Extra costs</T>
                    <T>
                      ₹
                      {[
                        draft.input.transport,
                        draft.input.loading,
                        draft.input.unloading,
                        draft.input.otherCosts,
                      ]
                        .reduce((sum, v) => sum + Number(v), 0)
                        .toFixed(2)}
                    </T>
                  </Row>
                  <Row>
                    <T>Discount</T>
                    <T>₹{draft.input.discount}</T>
                  </Row>
                </>
              )}
              <Row>
                <T>Subtotal</T>
                <T>{rupees(draft.totals.subtotal)}</T>
              </Row>
              <Row>
                <T>Tax</T>
                <T>{rupees(draft.totals.tax)}</T>
              </Row>
              <Row>
                <T size={18} weight="bold">
                  Total
                </T>
                <T size={23} color={c.accent} weight="bold">
                  {rupees(draft.totals.total)}
                </T>
              </Row>
              <T color={c.muted} size={12}>
                {draft.input.date}
                {isTrade
                  ? ` · ${draft.input.delivery}`
                  : payment
                    ? ` · ${draft.input.method.toUpperCase()}`
                    : ""}
                {draft.input.dueDate ? ` · Due ${draft.input.dueDate}` : ""}
              </T>
              {!!draft.input.reference && (
                <T size={12}>Reference: {draft.input.reference}</T>
              )}
              {!!draft.input.notes && <T size={12}>{draft.input.notes}</T>}
            </Card>
            <ErrorNotice error={confirmError} />
            <Button
              title="Confirm & save"
              busy={saving}
              onPress={() => void save()}
            />
            <Button
              title="Edit details"
              variant="secondary"
              disabled={saving}
              onPress={edit}
            />
          </>
        )}
      </ConfirmationSheet>
    </Screen>
  );
}
