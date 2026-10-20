import { describe, expect, it } from "vitest";
import type { TradeRecord } from "@tamiltrade/shared";
import {
  eligibleSources,
  soleChoice,
  tradeDefaults,
} from "../../mobile/services/trade-defaults.js";

const lot = (changes: Partial<TradeRecord> = {}): TradeRecord => ({
  _id: "lot-1",
  kind: "purchase",
  contactId: "supplier",
  productId: "sago",
  quantity: 50,
  allocatedQuantity: 20,
  unitPrice: "1000",
  total: 5000000,
  paid: 200000,
  subtotal: 5000000,
  tax: 0,
  cost: 5000000,
  allocatedCost: 2000000,
  status: "posted",
  delivery: "warehouse",
  date: "2026-10-19",
  createdAt: "2026-10-19T00:00:00Z",
  transport: "0",
  loading: "0",
  unloading: "0",
  otherCosts: "0",
  discount: "0",
  taxBps: 0,
  method: "cash",
  category: "Miscellaneous",
  reference: "",
  notes: "",
  ...changes,
});

describe("transaction smart defaults", () => {
  it("leaves negotiated quantities, prices and amounts empty while defaulting date and optional costs", () => {
    expect(tradeDefaults(null, "2026-10-19")).toMatchObject({
      date: "2026-10-19",
      delivery: "warehouse",
      quantity: "",
      unitPrice: "",
      amount: "",
      transport: "0",
      taxBps: "0",
      dueDate: "",
    });
  });
  it("preserves every AI or contextual value, including notes, references, zero and non-default terms", () => {
    const input = {
      kind: "sale" as const,
      contactId: "customer",
      productId: "sago",
      sourceId: "lot-1",
      quantity: 7,
      unitPrice: "123.45",
      amount: "0",
      transport: "80",
      loading: "5",
      unloading: "6",
      otherCosts: "7",
      discount: "2",
      taxBps: 525,
      date: "2026-10-10",
      dueDate: "2026-10-30",
      method: "upi" as const,
      category: "Office",
      reference: "INV-42",
      notes: "Deliver tomorrow",
      delivery: "direct" as const,
    };
    const { kind, ...expected } = input;
    expect(tradeDefaults(input, "2026-10-19")).toEqual({
      ...expected,
      quantity: "7",
      taxBps: "5.25",
    });
  });
  it("never selects an account, product or lot from incomplete options or overwrites a chosen value", () => {
    expect(soleChoice([{ _id: "a" }], false, "")).toBeUndefined();
    expect(soleChoice([{ _id: "a" }], true, "chosen-by-user")).toBeUndefined();
    expect(soleChoice([{ _id: "a" }, { _id: "b" }], true, "")).toBeUndefined();
    expect(soleChoice([], true, "")).toBeUndefined();
    expect(soleChoice([{ _id: "a" }], true, "")).toBe("a");
  });
  it("considers only posted purchase lots with stock for the matching product and delivery", () => {
    const items = [
      lot(),
      lot({ _id: "other-product", productId: "rice" }),
      lot({ _id: "direct", delivery: "direct" }),
      lot({ _id: "reversed", status: "reversed" }),
      lot({ _id: "sold", allocatedQuantity: 50 }),
      lot({ _id: "sale", kind: "sale" }),
    ];
    expect(
      eligibleSources(items, "sale", "customer", "sago", "warehouse").map(
        (s) => s._id,
      ),
    ).toEqual(["lot-1"]);
    expect(
      eligibleSources(items, "sale", "customer", "sago", "direct").map(
        (s) => s._id,
      ),
    ).toEqual(["direct"]);
    expect(eligibleSources(items, "sale", "customer", "", "warehouse")).toEqual(
      [],
    );
  });
  it("allocates customer receipts only to that customer's unpaid posted sales", () => {
    const sale = lot({ kind: "sale", contactId: "customer" });
    const items = [
      sale,
      lot({ contactId: "customer" }),
      { ...sale, _id: "other", contactId: "other-customer" },
      { ...sale, _id: "settled", paid: sale.total },
      { ...sale, _id: "void", status: "reversed" as const },
    ];
    expect(
      eligibleSources(items, "customer_payment", "customer", "", "warehouse"),
    ).toEqual([sale]);
  });
  it("allocates supplier payments only to that supplier's unpaid purchases", () => {
    const items = [
      lot(),
      lot({ _id: "other", contactId: "other-supplier" }),
      lot({ _id: "sale", kind: "sale" }),
      lot({ _id: "settled", paid: 5000000 }),
    ];
    expect(
      eligibleSources(
        items,
        "supplier_payment",
        "supplier",
        "",
        "warehouse",
      ).map((s) => s._id),
    ).toEqual(["lot-1"]);
    expect(
      eligibleSources(items, "supplier_payment", "", "", "warehouse"),
    ).toEqual([]);
    expect(
      eligibleSources(items, "expense", "supplier", "sago", "warehouse"),
    ).toEqual([]);
  });
});
