import mongoose, { Schema } from "mongoose";
import type { TradeInput, Permission } from "@tamiltrade/shared";
const scoped = {
  businessId: { type: Schema.Types.ObjectId, required: true, index: true },
};
const opts = { timestamps: true };
export interface BusinessDoc {
  name: string;
  type: string;
  address: string;
  phone: string;
  taxId: string;
  bankDetails: string;
  upi: string;
  invoicePrefix: string;
  currency: string;
  valuation: string;
  mutationVersion: number;
  createdAt: Date;
}
const businessSchema = new Schema<BusinessDoc>(
  {
    name: { type: String, required: true },
    type: String,
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    taxId: { type: String, default: "" },
    bankDetails: { type: String, default: "" },
    upi: { type: String, default: "" },
    invoicePrefix: { type: String, default: "SG" },
    currency: { type: String, default: "INR" },
    valuation: { type: String, default: "specific-lot" },
    mutationVersion: { type: Number, default: 0 },
  },
  opts,
);
export const Business = mongoose.model("Business", businessSchema);
export interface UserDoc {
  businessId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: "owner" | "staff";
  permissions: Permission[];
  active: boolean;
}
const userSchema = new Schema<UserDoc>(
  {
    ...scoped,
    name: String,
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["owner", "staff"], required: true },
    permissions: [String],
    active: { type: Boolean, default: true },
  },
  opts,
);
export const User = mongoose.model("User", userSchema);
export const Session = mongoose.model(
  "Session",
  new Schema(
    {
      ...scoped,
      userId: { type: Schema.Types.ObjectId, required: true, index: true },
      tokenHash: { type: String, required: true, select: false },
      expiresAt: { type: Date, required: true },
      revokedAt: Date,
      device: { type: String, default: "Mobile" },
    },
    opts,
  ).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
);
export const Recovery = mongoose.model(
  "Recovery",
  new Schema(
    {
      userId: { type: Schema.Types.ObjectId, required: true },
      hash: { type: String, unique: true },
      expiresAt: { type: Date, required: true },
    },
    opts,
  ).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
);
export interface ContactDoc {
  businessId: mongoose.Types.ObjectId;
  name: string;
  kind: "customer" | "supplier";
  aliases: string[];
  phone?: string;
  address: string;
  paymentTermsDays: number;
  creditLimit: number;
}
export const Contact = mongoose.model(
  "Contact",
  new Schema<ContactDoc>(
    {
      ...scoped,
      name: { type: String, required: true },
      kind: { type: String, enum: ["customer", "supplier"], required: true },
      aliases: [String],
      phone: String,
      address: String,
      paymentTermsDays: Number,
      creditLimit: Number,
    },
    opts,
  ).index({ businessId: 1, kind: 1, name: 1 }),
);
export interface ProductDoc {
  businessId: mongoose.Types.ObjectId;
  name: string;
  category: string;
  unit: string;
  weightGrams: number;
  lowStockQuantity: number;
}
export const Product = mongoose.model(
  "Product",
  new Schema<ProductDoc>(
    {
      ...scoped,
      name: { type: String, required: true },
      category: String,
      unit: String,
      weightGrams: Number,
      lowStockQuantity: Number,
    },
    opts,
  ).index({ businessId: 1, name: 1 }, { unique: true }),
);
export interface RecordDoc {
  businessId: mongoose.Types.ObjectId;
  kind: TradeInput["kind"];
  input: TradeInput;
  contactId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  sourceId?: mongoose.Types.ObjectId;
  contactName?: string;
  productName?: string;
  date: string;
  dueDate?: string;
  delivery: string;
  quantity: number;
  subtotal: number;
  tax: number;
  total: number;
  cost: number;
  paid: number;
  allocatedQuantity: number;
  allocatedCost: number;
  status: "posted" | "reversed";
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  reversedAt?: Date;
  reversalReason?: string;
}
export const Record = mongoose.model(
  "Record",
  new Schema<RecordDoc>(
    {
      ...scoped,
      kind: { type: String, required: true },
      input: { type: Schema.Types.Mixed, required: true },
      contactId: Schema.Types.ObjectId,
      productId: Schema.Types.ObjectId,
      sourceId: Schema.Types.ObjectId,
      contactName: String,
      productName: String,
      date: String,
      dueDate: String,
      delivery: String,
      quantity: { type: Number, default: 0 },
      subtotal: Number,
      tax: Number,
      total: Number,
      cost: { type: Number, default: 0 },
      paid: { type: Number, default: 0 },
      allocatedQuantity: { type: Number, default: 0 },
      allocatedCost: { type: Number, default: 0 },
      status: { type: String, enum: ["posted", "reversed"], default: "posted" },
      createdBy: Schema.Types.ObjectId,
      reversedAt: Date,
      reversalReason: String,
    },
    opts,
  )
    .index({ businessId: 1, date: -1, _id: -1 })
    .index({ businessId: 1, contactId: 1, status: 1 })
    .index({ businessId: 1, productId: 1, kind: 1 }),
);
export interface DraftDoc {
  businessId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  key: string;
  hash: string;
  input: TradeInput;
  totals: { subtotal: number; tax: number; total: number };
  status: "pending" | "confirmed" | "cancelled";
  recordId?: mongoose.Types.ObjectId;
  expiresAt: Date;
}
export const Draft = mongoose.model(
  "Draft",
  new Schema<DraftDoc>(
    {
      ...scoped,
      userId: { type: Schema.Types.ObjectId, required: true },
      key: { type: String, required: true },
      hash: String,
      input: { type: Schema.Types.Mixed, required: true },
      totals: { type: Schema.Types.Mixed, required: true },
      status: { type: String, default: "pending" },
      recordId: Schema.Types.ObjectId,
      expiresAt: Date,
    },
    opts,
  ).index({ businessId: 1, userId: 1, key: 1 }, { unique: true }),
);
export const Movement = mongoose.model(
  "Movement",
  new Schema(
    {
      ...scoped,
      recordId: Schema.Types.ObjectId,
      lotId: Schema.Types.ObjectId,
      productId: Schema.Types.ObjectId,
      quantity: Number,
      reason: String,
    },
    opts,
  ).index({ businessId: 1, lotId: 1, createdAt: -1 }),
);
export const Audit = mongoose.model(
  "Audit",
  new Schema(
    {
      ...scoped,
      userId: Schema.Types.ObjectId,
      action: String,
      entityId: Schema.Types.ObjectId,
      details: Schema.Types.Mixed,
    },
    opts,
  ).index({ businessId: 1, createdAt: -1 }),
);
export const Counter = mongoose.model(
  "Counter",
  new Schema({
    ...scoped,
    year: String,
    value: { type: Number, default: 0 },
  }).index({ businessId: 1, year: 1 }, { unique: true }),
);
export interface InvoiceDoc {
  businessId: mongoose.Types.ObjectId;
  saleId: mongoose.Types.ObjectId;
  status: "draft" | "issued" | "cancelled";
  number?: string;
  snapshot?: {
    business: Record<string, string>;
    sale: TradeInput;
    customer: Record<string, string>;
    subtotal: number;
    tax: number;
    total: number;
    productName: string;
  };
  issuedAt?: Date;
  cancelledAt?: Date;
  shareHash?: string;
  shareExpiresAt?: Date;
  createdAt: Date;
}
export const Invoice = mongoose.model(
  "Invoice",
  new Schema<InvoiceDoc>(
    {
      ...scoped,
      saleId: { type: Schema.Types.ObjectId, required: true },
      status: { type: String, default: "draft" },
      number: String,
      snapshot: Schema.Types.Mixed,
      issuedAt: Date,
      cancelledAt: Date,
      shareHash: String,
      shareExpiresAt: Date,
    },
    opts,
  )
    .index({ businessId: 1, saleId: 1 }, { unique: true })
    .index(
      { businessId: 1, number: 1 },
      {
        unique: true,
        partialFilterExpression: { number: { $type: "string" } },
      },
    ),
);
export interface VoiceJobDoc {
  businessId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  key: string;
  path: string;
  status:
    | "queued"
    | "transcribing"
    | "understanding"
    | "completed"
    | "error"
    | "cancelled";
  transcript?: string;
  result?: unknown;
  error?: string;
  errorCode?: string;
  retryAt?: Date;
  leaseUntil?: Date;
  expiresAt: Date;
  createdAt: Date;
}
export const VoiceJob = mongoose.model(
  "VoiceJob",
  new Schema<VoiceJobDoc>(
    {
      ...scoped,
      userId: Schema.Types.ObjectId,
      key: String,
      path: { type: String, select: false },
      status: { type: String, default: "queued" },
      transcript: String,
      result: Schema.Types.Mixed,
      error: String,
      errorCode: String,
      retryAt: Date,
      leaseUntil: Date,
      expiresAt: Date,
    },
    opts,
  )
    .index({ businessId: 1, userId: 1, key: 1 }, { unique: true })
    .index({ status: 1, createdAt: 1 })
    .index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
);
export const Conversation = mongoose.model(
  "Conversation",
  new Schema(
    {
      ...scoped,
      userId: Schema.Types.ObjectId,
      contactId: Schema.Types.ObjectId,
      purchaseId: Schema.Types.ObjectId,
      saleId: Schema.Types.ObjectId,
      pendingInput: Schema.Types.Mixed,
      pendingCatalogAction: Schema.Types.Mixed,
      lastCatalogSave: Schema.Types.Mixed,
      pendingQuestion: Schema.Types.Mixed,
      pendingSourceIds: { type: [String], default: [] },
      messages: { type: [Schema.Types.Mixed], default: [] },
      expiresAt: Date,
    },
    opts,
  )
    .index({ businessId: 1, userId: 1 }, { unique: true })
    .index({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
);
export async function connectDatabase(
  uri: string,
  options: Pick<
    mongoose.ConnectOptions,
    "socketTimeoutMS" | "waitQueueTimeoutMS"
  > = {},
) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
    ...options,
  });
}
export async function ensureIndexes() {
  await Promise.all(
    mongoose.modelNames().map((name) => mongoose.model(name).init()),
  );
  await QueueState.updateOne(
    { _id: "voice" },
    { $setOnInsert: { version: 0 } },
    { upsert: true },
  );
}
export const QueueState = mongoose.model(
  "QueueState",
  new Schema({
    _id: String,
    version: { type: Number, default: 0 },
    leaseOwner: String,
    leaseUntil: Date,
    heartbeatOwner: String,
    heartbeatAt: Date,
  }),
);
