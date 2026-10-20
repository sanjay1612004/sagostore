import type { TradeInput, TradeRecord } from "@tamiltrade/shared";

export function tradeDefaults(
  input: Partial<TradeInput> | null,
  today: string,
) {
  return {
    contactId: input?.contactId ?? "",
    productId: input?.productId ?? "",
    sourceId: input?.sourceId ?? "",
    quantity: String(input?.quantity ?? ""),
    unitPrice: input?.unitPrice ?? "",
    amount: input?.amount ?? "",
    transport: input?.transport ?? "0",
    loading: input?.loading ?? "0",
    unloading: input?.unloading ?? "0",
    otherCosts: input?.otherCosts ?? "0",
    discount: input?.discount ?? "0",
    taxBps: String((input?.taxBps ?? 0) / 100),
    date: input?.date ?? today,
    dueDate: input?.dueDate ?? "",
    method: input?.method ?? "cash",
    category: input?.category ?? "Miscellaneous",
    reference: input?.reference ?? "",
    notes: input?.notes ?? "",
    delivery: input?.delivery ?? "warehouse",
  };
}

// Never infer uniqueness from a partially loaded or refreshing catalog.
export function soleChoice<T extends { _id: string }>(
  items: T[],
  complete: boolean,
  current: string,
): string | undefined {
  return !current && complete && items.length === 1 ? items[0]!._id : undefined;
}

export function eligibleSources(
  items: TradeRecord[],
  kind: TradeInput["kind"],
  contactId: string,
  productId: string,
  delivery: TradeInput["delivery"],
) {
  return items.filter((s) => {
    if (s.status !== "posted") return false;
    if (kind === "sale")
      return (
        !!productId &&
        s.kind === "purchase" &&
        s.productId === productId &&
        s.delivery === delivery &&
        (s.quantity ?? 0) > s.allocatedQuantity
      );
    if (kind === "customer_payment" || kind === "supplier_payment")
      return (
        !!contactId &&
        s.contactId === contactId &&
        s.kind === (kind === "customer_payment" ? "sale" : "purchase") &&
        s.total > s.paid
      );
    return false;
  });
}
