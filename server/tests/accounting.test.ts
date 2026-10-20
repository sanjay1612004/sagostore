import { describe, it, expect } from "vitest";
import { tradeSchema } from "@tamiltrade/shared";
import { paise, calculate, proportion } from "../src/shared/money.js";
const purchase = tradeSchema.parse({
  kind: "purchase",
  contactId: "a".repeat(24),
  productId: "b".repeat(24),
  quantity: 50,
  unitPrice: "3200",
  transport: "2500",
  date: "2026-10-16",
});
describe("decimal-safe financial calculations", () => {
  it("calculates the acceptance purchase and sale profit", () => {
    expect(calculate(purchase)).toEqual({
      subtotal: 16000000,
      tax: 0,
      total: 16250000,
    });
    const cost = proportion(16250000, 20, 50);
    expect(cost).toBe(6500000);
    const sale = calculate({
      ...purchase,
      kind: "sale",
      sourceId: "c".repeat(24),
      quantity: 20,
      unitPrice: "3500",
      transport: "0",
    });
    expect(sale.total - cost).toBe(500000);
    expect(sale.total - paise("20000")).toBe(5000000);
  });
  it("represents decimal amounts exactly", () => {
    expect(paise("0.10") + paise("0.20")).toBe(30);
    expect(paise("9999999999.99")).toBe(999999999999);
  });
  it("rejects malformed and negative amounts", () => {
    for (const value of ["-1", "0.001", "NaN", "1e3", "Infinity", "1,000"])
      expect(() => paise(value)).toThrow();
  });
  it("allocates cumulative rounding without losing a paise", () => {
    const cumulative = [1, 2, 3].map((n) => proportion(100, n, 3));
    expect(cumulative).toEqual([33, 67, 100]);
  });
  it("applies explicit configured tax and discounts", () => {
    expect(
      calculate({
        ...purchase,
        quantity: 1,
        unitPrice: "100",
        discount: "10",
        taxBps: 500,
        transport: "0",
      }),
    ).toEqual({ subtotal: 10000, tax: 450, total: 9450 });
  });
  it("rejects excessive discount and numeric overflow", () => {
    expect(() => calculate({ ...purchase, discount: "9999999" })).toThrow();
    expect(() =>
      calculate({ ...purchase, quantity: 1000000, unitPrice: "9999999999.99" }),
    ).toThrow();
  });
  it("rejects missing payment allocations and invalid due dates", () => {
    expect(
      tradeSchema.safeParse({
        kind: "customer_payment",
        amount: "20",
        date: "2026-10-16",
      }).success,
    ).toBe(false);
    expect(
      tradeSchema.safeParse({ ...purchase, dueDate: "2026-10-15" }).success,
    ).toBe(false);
  });
});
