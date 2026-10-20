import mongoose, { type ClientSession } from "mongoose";
import { createHash } from "node:crypto";
import type { TradeInput, Permission } from "@tamiltrade/shared";
import { tradeSchema } from "@tamiltrade/shared";
import {
  Business,
  Contact,
  Product,
  Record,
  Draft,
  Movement,
  Audit,
  Invoice,
  Conversation,
} from "./models.js";
import { calculate, proportion, paise } from "../shared/money.js";
import { assert } from "../shared/errors.js";
import type { Principal } from "./auth.js";
export const permissionFor = (kind: TradeInput["kind"]): Permission =>
  kind === "purchase"
    ? "purchases"
    : kind === "sale"
      ? "sales"
      : kind === "expense"
        ? "expenses"
        : "payments";
export const can = (auth: Principal, permission: Permission) =>
  auth.role === "owner" || auth.permissions.includes(permission);
const objectId = (id: string) => new mongoose.Types.ObjectId(id);
export const recordView = <T extends { input: TradeInput }>(r: T) => ({
  ...r,
  ...r.input,
});
export async function balance(
  businessId: string,
  contactId: string,
  session?: ClientSession,
) {
  const rows = await Record.aggregate<{ _id: null; balance: number }>([
    {
      $match: {
        businessId: objectId(businessId),
        contactId: objectId(contactId),
        status: "posted",
      },
    },
    {
      $group: {
        _id: null,
        balance: {
          $sum: {
            $cond: [
              { $in: ["$kind", ["sale", "purchase"]] },
              "$total",
              { $multiply: ["$total", -1] },
            ],
          },
        },
      },
    },
  ]).session(session ?? null);
  return rows[0]?.balance ?? 0;
}
export async function preview(auth: Principal, body: unknown, key: string) {
  const input = tradeSchema.parse(body);
  assert(
    can(auth, permissionFor(input.kind)),
    403,
    "FORBIDDEN",
    "Permission required",
  );
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const existing = await Draft.findOne({
    businessId: auth.businessId,
    userId: auth.userId,
    key,
  });
  if (existing) {
    assert(
      existing.hash === hash,
      409,
      "IDEMPOTENCY_CONFLICT",
      "This request key was already used with different values",
    );
    return existing;
  }
  await validateReferences(auth, input);
  try {
    return await Draft.create({
      businessId: auth.businessId,
      userId: auth.userId,
      key,
      hash,
      input,
      totals: calculate(input),
      expiresAt: new Date(Date.now() + 30 * 60000),
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const retry = await Draft.findOne({
        businessId: auth.businessId,
        userId: auth.userId,
        key,
      });
      assert(
        retry?.hash === hash,
        409,
        "IDEMPOTENCY_CONFLICT",
        "Request key already used",
      );
      return retry;
    }
    throw error;
  }
}
async function validateReferences(
  auth: Principal,
  input: TradeInput,
  session?: ClientSession,
) {
  const scope = { businessId: auth.businessId };
  const contact = input.contactId
    ? await Contact.findOne({ ...scope, _id: input.contactId }).session(
        session ?? null,
      )
    : null;
  const product = input.productId
    ? await Product.findOne({ ...scope, _id: input.productId }).session(
        session ?? null,
      )
    : null;
  const source = input.sourceId
    ? await Record.findOne({
        ...scope,
        _id: input.sourceId,
        status: "posted",
      }).session(session ?? null)
    : null;
  if (input.contactId)
    assert(
      contact,
      404,
      "CONTACT_NOT_FOUND",
      "Choose a contact in this business",
    );
  if (input.productId)
    assert(
      product,
      404,
      "PRODUCT_NOT_FOUND",
      "Choose a product in this business",
    );
  if (input.sourceId)
    assert(
      source,
      404,
      "SOURCE_NOT_FOUND",
      "The selected source transaction is unavailable",
    );
  if (input.kind === "expense")
    assert(
      !input.sourceId,
      422,
      "EXPENSE_ALLOCATION",
      "Operating expenses must be separate from costs already included in a purchase. Edit and reconfirm the purchase to add capitalized costs",
    );
  if (input.kind === "purchase" || input.kind === "supplier_payment")
    assert(
      contact?.kind === "supplier",
      422,
      "CONTACT_KIND",
      "Select a supplier",
    );
  if (input.kind === "sale" || input.kind === "customer_payment")
    assert(
      contact?.kind === "customer",
      422,
      "CONTACT_KIND",
      "Select a customer",
    );
  if (input.kind === "sale") {
    assert(
      source?.kind === "purchase" &&
        String(source.productId) === input.productId,
      422,
      "SOURCE_MISMATCH",
      "Select a purchase lot for the same product",
    );
    assert(
      source.delivery === input.delivery,
      422,
      "DELIVERY_MISMATCH",
      "Sale delivery must match its purchase lot",
    );
    assert(
      source.quantity - source.allocatedQuantity >= input.quantity!,
      409,
      "INSUFFICIENT_STOCK",
      "The selected lot has insufficient remaining quantity",
    );
  }
  if (input.kind.endsWith("payment")) {
    const kind = input.kind === "customer_payment" ? "sale" : "purchase";
    assert(
      source?.kind === kind && String(source.contactId) === input.contactId,
      422,
      "ALLOCATION_MISMATCH",
      "Choose an outstanding transaction for this contact",
    );
    assert(
      paise(input.amount!) <= source.total - source.paid,
      422,
      "OVERPAYMENT",
      "Payment exceeds the selected transaction balance. Split allocations explicitly",
    );
  }
  return { contact, product, source };
}
export async function confirm(auth: Principal, draftId: string) {
  const result = await mongoose.connection.transaction(async (session) => {
    // Serializes business writes to prevent credit-limit and ledger write skew.
    await Business.updateOne(
      { _id: auth.businessId },
      { $inc: { mutationVersion: 1 } },
      { session },
    );
    const draft = await Draft.findOne({
      _id: draftId,
      businessId: auth.businessId,
      userId: auth.userId,
    }).session(session);
    assert(draft, 404, "DRAFT_NOT_FOUND", "Confirmation preview not found");
    if (draft.status === "confirmed")
      return (await Record.findOne({
        _id: draft.recordId,
        businessId: auth.businessId,
      }).session(session))!;
    assert(
      draft.status === "pending" && draft.expiresAt > new Date(),
      409,
      "DRAFT_EXPIRED",
      "This preview expired or was cancelled. Create a new preview",
    );
    const input = tradeSchema.parse(draft.input);
    assert(
      can(auth, permissionFor(input.kind)),
      403,
      "FORBIDDEN",
      "Permission required",
    );
    const { contact, product, source } = await validateReferences(
      auth,
      input,
      session,
    );
    const totals = calculate(input);
    let cost = 0;
    if (input.kind === "purchase") cost = totals.total; // Inclusive tax valuation; no assumed input-tax credit.
    if (input.kind === "sale") {
      const newAllocated = source!.allocatedQuantity + input.quantity!;
      // Cumulative rounding assigns the exact final paise to the last allocation.
      cost =
        proportion(source!.cost, newAllocated, source!.quantity) -
        source!.allocatedCost;
      const updated = await Record.updateOne(
        {
          _id: source!._id,
          allocatedQuantity: source!.allocatedQuantity,
          status: "posted",
        },
        { $inc: { allocatedQuantity: input.quantity!, allocatedCost: cost } },
        { session },
      );
      assert(
        updated.modifiedCount === 1,
        409,
        "STOCK_CHANGED",
        "Stock changed; review this sale again",
      );
      if (contact!.creditLimit > 0)
        assert(
          (await balance(auth.businessId, input.contactId!, session)) +
            totals.total <=
            contact!.creditLimit,
          422,
          "CREDIT_LIMIT",
          "This sale would exceed the customer credit limit",
        );
    }
    if (input.kind.endsWith("payment")) {
      const updated = await Record.updateOne(
        { _id: source!._id, paid: source!.paid, status: "posted" },
        { $inc: { paid: totals.total } },
        { session },
      );
      assert(
        updated.modifiedCount === 1,
        409,
        "BALANCE_CHANGED",
        "The balance changed; review the payment again",
      );
    }
    const [record] = await Record.create(
      [
        {
          businessId: auth.businessId,
          createdBy: auth.userId,
          kind: input.kind,
          input,
          contactId: input.contactId,
          productId: input.productId,
          sourceId: input.sourceId,
          contactName: contact?.name,
          productName: product?.name,
          date: input.date,
          dueDate: input.dueDate,
          delivery: input.delivery,
          quantity: input.quantity ?? 0,
          ...totals,
          cost,
        },
      ],
      { session },
    );
    if (
      (input.kind === "purchase" || input.kind === "sale") &&
      input.delivery === "warehouse"
    )
      await Movement.create(
        [
          {
            businessId: auth.businessId,
            recordId: record!._id,
            lotId: input.kind === "purchase" ? record!._id : source!._id,
            productId: input.productId,
            quantity:
              input.kind === "purchase" ? input.quantity : -input.quantity!,
            reason: input.kind,
          },
        ],
        { session },
      );
    await Audit.create(
      [
        {
          businessId: auth.businessId,
          userId: auth.userId,
          action: `CONFIRM_${input.kind.toUpperCase()}`,
          entityId: record!._id,
          details: { draftId },
        },
      ],
      { session },
    );
    await Draft.updateOne(
      { _id: draft._id },
      { $set: { status: "confirmed", recordId: record!._id } },
      { session },
    );
    const context =
      input.kind === "purchase"
        ? { purchaseId: record!._id }
        : input.kind === "sale"
          ? { saleId: record!._id }
          : {};
    await Conversation.findOneAndUpdate(
      { businessId: auth.businessId, userId: auth.userId },
      {
        $set: {
          ...context,
          ...(contact ? { contactId: contact._id } : {}),
          pendingInput: null,
          pendingQuestion: null,
          pendingSourceIds: [],
          expiresAt: new Date(Date.now() + 30 * 60000),
        },
      },
      { upsert: true, session },
    );
    return record!;
  });
  return recordView(result.toObject());
}
export async function reverse(
  auth: Principal,
  recordId: string,
  reason: string,
) {
  assert(
    auth.role === "owner",
    403,
    "FORBIDDEN",
    "Only the owner can reverse financial records",
  );
  await mongoose.connection.transaction(async (session) => {
    await Business.updateOne(
      { _id: auth.businessId },
      { $inc: { mutationVersion: 1 } },
      { session },
    );
    const record = await Record.findOne({
      _id: recordId,
      businessId: auth.businessId,
    }).session(session);
    assert(record, 404, "NOT_FOUND", "Transaction not found");
    if (record.status === "reversed") return;
    assert(
      record.paid === 0 && record.allocatedQuantity === 0,
      409,
      "HAS_DEPENDENTS",
      "Reverse linked payments and sales first",
    );
    const invoice = await Invoice.findOne({
      businessId: auth.businessId,
      saleId: recordId,
      status: "issued",
    }).session(session);
    assert(
      !invoice,
      409,
      "ISSUED_INVOICE",
      "Cancel the issued invoice before reversing this sale",
    );
    if (record.kind === "sale") {
      const source = await Record.findOne({
        _id: record.sourceId,
        businessId: auth.businessId,
      }).session(session);
      assert(source, 409, "SOURCE_MISSING", "Source purchase is unavailable");
      await Record.updateOne(
        { _id: source._id },
        {
          $inc: {
            allocatedQuantity: -record.quantity,
            allocatedCost: -record.cost,
          },
        },
        { session },
      );
    }
    if (record.kind.endsWith("payment"))
      await Record.updateOne(
        { _id: record.sourceId, businessId: auth.businessId },
        { $inc: { paid: -record.total } },
        { session },
      );
    const movements = await Movement.find({
      recordId,
      businessId: auth.businessId,
    }).session(session);
    for (const movement of movements)
      await Movement.create(
        [
          {
            businessId: auth.businessId,
            recordId: record._id,
            lotId: movement.lotId,
            productId: movement.productId,
            quantity: -(movement.quantity ?? 0),
            reason: "reversal",
          },
        ],
        { session },
      );
    record.status = "reversed";
    record.reversedAt = new Date();
    record.reversalReason = reason;
    await record.save({ session });
    await Audit.create(
      [
        {
          businessId: auth.businessId,
          userId: auth.userId,
          action: "REVERSE_RECORD",
          entityId: record._id,
          details: { reason },
        },
      ],
      { session },
    );
  });
}
