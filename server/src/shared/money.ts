import type { TradeInput } from "@tamiltrade/shared";
import { assert } from "./errors.js";
export function safeInteger(value: bigint): number {
  assert(
    value >= -BigInt(Number.MAX_SAFE_INTEGER) &&
      value <= BigInt(Number.MAX_SAFE_INTEGER),
    422,
    "AMOUNT_LIMIT",
    "Amount exceeds supported accounting limits",
  );
  return Number(value);
}
export function paise(value: string): number {
  assert(
    /^\d{1,10}(\.\d{1,2})?$/.test(value),
    422,
    "INVALID_MONEY",
    "Enter a non-negative amount with at most two decimals",
  );
  const [whole = "0", fraction = ""] = value.split(".");
  return safeInteger(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
}
export function proportion(
  total: number,
  quantity: number,
  originalQuantity: number,
): number {
  assert(
    originalQuantity > 0 && quantity >= 0,
    422,
    "QUANTITY",
    "Invalid allocation quantity",
  );
  return safeInteger(
    (BigInt(total) * BigInt(quantity) +
      BigInt(Math.floor(originalQuantity / 2))) /
      BigInt(originalQuantity),
  );
}
export function calculate(input: TradeInput) {
  if (input.kind === "expense" || input.kind.endsWith("payment")) {
    const total = paise(input.amount!);
    assert(total > 0, 422, "ZERO_AMOUNT", "Amount must be greater than zero");
    return { subtotal: total, tax: 0, total };
  }
  const subtotal = safeInteger(
    BigInt(paise(input.unitPrice!)) * BigInt(input.quantity!),
  );
  const costs = ["transport", "loading", "unloading", "otherCosts"].reduce(
    (sum, k) => sum + BigInt(paise(input[k as "transport"])),
    0n,
  );
  const taxable = BigInt(subtotal) - BigInt(paise(input.discount));
  assert(taxable >= 0n, 422, "DISCOUNT", "Discount exceeds the subtotal");
  const tax = safeInteger((taxable * BigInt(input.taxBps) + 5000n) / 10000n);
  const total = safeInteger(taxable + costs + BigInt(tax));
  assert(total > 0, 422, "ZERO_AMOUNT", "Total must be greater than zero");
  return { subtotal, tax, total };
}
