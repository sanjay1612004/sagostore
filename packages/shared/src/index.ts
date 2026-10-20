import { z } from "zod";

// All money crossing the API is a decimal string. Persistence uses integer paise.
export const money = z
  .string()
  .regex(
    /^\d{1,10}(\.\d{1,2})?$/,
    "Enter rupees with at most two decimal places",
  );
export const id = z.string().regex(/^[a-f\d]{24}$/i, "Choose a valid record");
export const permissions = [
  "purchases",
  "sales",
  "payments",
  "expenses",
  "invoices",
  "contacts",
  "reports",
] as const;
export type Permission = (typeof permissions)[number];
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["customer", "supplier"]),
  aliases: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  phone: z
    .string()
    .regex(/^\+?[\d\s-]{7,18}$/)
    .optional()
    .or(z.literal("")),
  address: z.string().max(500).default(""),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  creditLimit: money.default("0"),
});
export const productSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.string().max(100).default(""),
  unit: z.string().min(1).max(30).default("bag"),
  weightGrams: z.number().int().positive().max(1000000).default(50000),
  lowStockQuantity: z.number().int().min(0).default(10),
});
export const tradeSchema = z
  .object({
    kind: z.enum([
      "purchase",
      "sale",
      "expense",
      "customer_payment",
      "supplier_payment",
    ]),
    contactId: id.optional(),
    productId: id.optional(),
    sourceId: id.optional(),
    quantity: z.number().int().min(1).max(1000000).optional(),
    unitPrice: money.optional(),
    amount: money.optional(),
    transport: money.default("0"),
    loading: money.default("0"),
    unloading: money.default("0"),
    otherCosts: money.default("0"),
    discount: money.default("0"),
    taxBps: z.number().int().min(0).max(10000).default(0),
    delivery: z.enum(["warehouse", "direct"]).default("warehouse"),
    date: z.iso.date(),
    dueDate: z.iso.date().optional(),
    method: z.enum(["cash", "upi", "bank", "cheque"]).default("cash"),
    category: z.string().trim().max(100).default("Miscellaneous"),
    reference: z.string().trim().max(120).default(""),
    notes: z.string().max(1000).default(""),
  })
  .superRefine((v, ctx) => {
    const need = (k: keyof typeof v) => {
      if (v[k] === undefined)
        ctx.addIssue({
          code: "custom",
          path: [k],
          message: `${k} is required`,
        });
    };
    if (v.kind === "purchase" || v.kind === "sale") {
      need("contactId");
      need("productId");
      need("quantity");
      need("unitPrice");
    }
    if (v.kind === "sale") need("sourceId");
    if (v.kind.endsWith("payment")) {
      need("contactId");
      need("sourceId");
      need("amount");
    }
    if (v.kind === "expense") need("amount");
    if (v.dueDate && v.dueDate < v.date)
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date cannot precede transaction date",
      });
  });
export type TradeInput = z.infer<typeof tradeSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export const registerSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(2).max(100),
  businessName: z.string().trim().min(2).max(150),
  businessType: z.string().max(100).default("Wholesale trading"),
});
export const loginSchema = registerSchema.pick({ email: true, password: true });
export type Entity = { _id: string; name: string; aliases?: string[] };
export type Contact = Entity &
  Omit<ContactInput, "creditLimit"> & { balance: number; creditLimit: number };
export type Product = Entity & ProductInput;
export type TradeRecord = TradeInput & {
  _id: string;
  total: number;
  subtotal: number;
  tax: number;
  cost: number;
  paid: number;
  allocatedQuantity: number;
  allocatedCost: number;
  status: "posted" | "reversed";
  contactName?: string;
  productName?: string;
  createdAt: string;
};
export type Draft = {
  _id: string;
  input: TradeInput;
  totals: { subtotal: number; tax: number; total: number };
  status: "pending" | "confirmed" | "cancelled";
  expiresAt: string;
  recordId?: string;
};
export type Dashboard = {
  todaySales: number;
  todayPurchases: number;
  paymentsReceived: number;
  receivables: number;
  payables: number;
  stock: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  grossProfit: number;
  operatingExpenses: number;
  trend: { date: string; sales: number; purchases: number }[];
  recent: TradeRecord[];
  insights: string[];
};
export const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
export const indiaDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
