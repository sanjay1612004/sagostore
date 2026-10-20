import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import pino from "pino";
import { pinoHttp } from "pino-http";
import mongoose from "mongoose";
import multer from "multer";
import { z, ZodError } from "zod";
import {
  id,
  contactSchema,
  productSchema,
  tradeSchema,
  permissions,
  indiaDate,
} from "@tamiltrade/shared";
import { env } from "./config/env.js";
import { AppError, assert } from "./shared/errors.js";
import { paise } from "./shared/money.js";
import {
  authRouter,
  authenticate,
  authorize,
  hashToken,
} from "./modules/auth.js";
import {
  Business,
  Contact,
  Product,
  Record,
  Draft,
  Movement,
  Audit,
  Invoice,
} from "./modules/models.js";
import {
  preview,
  confirm,
  reverse,
  recordView,
  can,
  permissionFor,
  balance,
} from "./modules/trading.js";
import {
  dashboard,
  inventory,
  priceHistory,
  contactsWithBalances,
  productStock,
} from "./modules/reporting.js";
import { voiceRouter } from "./modules/voice.js";
import { invoiceRouter, renderPdf } from "./modules/invoices.js";
import { voiceRateLimits } from "./shared/voice-rate-limits.js";
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "password",
    "passwordHash",
    "refreshToken",
    "accessToken",
    "token",
    "MONGODB_URI",
    "SARVAM_API_KEY",
    "GROQ_API_KEY",
  ],
});
const pagination = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const app = express();
app.disable("x-powered-by");
if (env.NODE_ENV === "production") app.set("trust proxy", "loopback");
app.use(
  helmet(),
  cors({
    origin: env.CORS_ORIGINS.split(",").filter(Boolean),
    credentials: false,
    exposedHeaders: ["Retry-After", "RateLimit", "RateLimit-Policy"],
  }),
  compression(),
);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req: (req) => ({
        method: req.method,
        url: String(req.url).startsWith("/share/")
          ? "/share/[redacted]"
          : req.url,
      }),
    },
  }),
);
app.get("/health/live", (_req, res) => {
  res.json({ status: "ok" });
});
app.get("/health/ready", async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ status: "unavailable" });
    return;
  }
  await mongoose.connection.db!.admin().ping();
  res.json({ status: "ready" });
});
app.use(express.json({ limit: "64kb" }));
app.use(
  rateLimit({
    windowMs: 60000,
    limit: env.NODE_ENV === "test" ? 10000 : 180,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "RATE_LIMIT",
        message: "Too many requests. Please wait a minute.",
      },
    },
  }),
);
app.use(
  "/auth",
  rateLimit({
    windowMs: 15 * 60000,
    limit: env.NODE_ENV === "test" ? 1000 : 30,
    skip: (req) =>
      !["/login", "/register", "/refresh", "/recover"].includes(req.path),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "AUTH_RATE_LIMIT",
        message: "Too many authentication attempts. Please wait 15 minutes.",
      },
    },
  }),
  authRouter,
);
app.get("/share/:token", async (req, res) => {
  const token = z
    .string()
    .regex(/^[a-f\d]{64}$/)
    .parse(req.params.token);
  const invoice = await Invoice.findOne({
    shareHash: hashToken(token),
    shareExpiresAt: { $gt: new Date() },
    status: "issued",
  }).lean();
  assert(
    invoice,
    404,
    "LINK_EXPIRED",
    "Invoice link has expired or was revoked",
  );
  const pdf = await renderPdf(invoice);
  res
    .set({
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    })
    .send(pdf);
});
app.use("/api", authenticate);
app.get("/api/business", async (req, res) => {
  res.json(await Business.findById(req.auth.businessId).lean());
});
app.patch("/api/business", authorize("owner"), async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(2).max(150),
      type: z.string().max(100),
      address: z.string().max(500),
      phone: z.string().max(30),
      taxId: z.string().max(50),
      bankDetails: z.string().max(500),
      upi: z.string().max(100),
      invoicePrefix: z.string().regex(/^[A-Z0-9]{1,10}$/),
    })
    .parse(req.body);
  await mongoose.connection.transaction(async (session) => {
    await Business.updateOne(
      { _id: req.auth.businessId },
      { $set: input },
      { session },
    );
    await Audit.create(
      [
        {
          businessId: req.auth.businessId,
          userId: req.auth.userId,
          action: "UPDATE_BUSINESS",
          entityId: req.auth.businessId,
        },
      ],
      { session },
    );
  });
  res.json(await Business.findById(req.auth.businessId).lean());
});
app.get("/api/dashboard", authorize("reports"), async (req, res) => {
  res.json(await dashboard(req.auth.businessId));
});
app.get("/api/contacts", async (req, res) => {
  const { page, limit } = pagination.parse(req.query);
  const kind = z
    .enum(["customer", "supplier"])
    .default("customer")
    .parse(req.query.kind);
  const search = z.string().max(100).default("").parse(req.query.search);
  res.json(
    await contactsWithBalances(req.auth.businessId, kind, search, page, limit),
  );
});
app.post("/api/contacts", authorize("contacts"), async (req, res) => {
  const input = contactSchema.parse(req.body);
  res.status(201).json(
    await Contact.create({
      ...input,
      creditLimit: paise(input.creditLimit),
      businessId: req.auth.businessId,
    }),
  );
});
app.get("/api/contacts/:id", async (req, res) => {
  const contactId = id.parse(req.params.id);
  const contact = await Contact.findOne({
    _id: contactId,
    businessId: req.auth.businessId,
  }).lean();
  assert(contact, 404, "NOT_FOUND", "Contact not found");
  res.json({
    ...contact,
    balance: await balance(req.auth.businessId, contactId),
  });
});
app.get("/api/contacts/:id/ledger", async (req, res) => {
  const contactId = id.parse(req.params.id);
  assert(
    await Contact.exists({ _id: contactId, businessId: req.auth.businessId }),
    404,
    "NOT_FOUND",
    "Contact not found",
  );
  const { page, limit } = pagination.parse(req.query);
  const scope = { businessId: req.auth.businessId, contactId };
  const [items, total] = await Promise.all([
    Record.find(scope)
      .sort({ date: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Record.countDocuments(scope),
  ]);
  res.json({
    items: items.map(recordView),
    total,
    page,
    limit,
    balance: await balance(req.auth.businessId, contactId),
  });
});
app.patch("/api/contacts/:id", authorize("contacts"), async (req, res) => {
  const input = contactSchema.parse(req.body);
  const contactId = id.parse(req.params.id);
  const contact = await Contact.findOne({
    _id: contactId,
    businessId: req.auth.businessId,
  });
  assert(contact, 404, "NOT_FOUND", "Contact not found");
  assert(
    contact.kind === input.kind,
    422,
    "CONTACT_KIND",
    "Contact type cannot change after creation",
  );
  Object.assign(contact, { ...input, creditLimit: paise(input.creditLimit) });
  await contact.save();
  res.json(contact);
});
app.get("/api/products", async (req, res) => {
  const { page, limit } = pagination.parse(req.query);
  const scope = { businessId: req.auth.businessId };
  const [items, total] = await Promise.all([
    Product.find(scope)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(scope),
  ]);
  res.json({ items, total, page, limit });
});
app.post("/api/products", authorize("contacts"), async (req, res) => {
  res.status(201).json(
    await Product.create({
      ...productSchema.parse(req.body),
      businessId: req.auth.businessId,
    }),
  );
});
app.get("/api/records", async (req, res) => {
  const { page, limit } = pagination.parse(req.query);
  const kind = z
    .enum([
      "purchase",
      "sale",
      "expense",
      "customer_payment",
      "supplier_payment",
    ])
    .optional()
    .parse(req.query.kind);
  const allowed = [
    "purchase",
    "sale",
    "expense",
    "customer_payment",
    "supplier_payment",
  ].filter((k) => can(req.auth, permissionFor(k as "sale")));
  if (kind)
    assert(allowed.includes(kind), 403, "FORBIDDEN", "Permission required");
  const dateFrom = z.iso.date().optional().parse(req.query.from),
    dateTo = z.iso.date().optional().parse(req.query.to);
  const contactId = id.optional().parse(req.query.contactId);
  const scope = {
    businessId: req.auth.businessId,
    kind: kind ?? { $in: allowed },
    ...(contactId ? { contactId } : {}),
    ...(dateFrom || dateTo
      ? {
          date: {
            ...(dateFrom ? { $gte: dateFrom } : {}),
            ...(dateTo ? { $lte: dateTo } : {}),
          },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    Record.find(scope)
      .sort({ date: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Record.countDocuments(scope),
  ]);
  res.json({ items: items.map(recordView), total, page, limit });
});
app.get("/api/records/:id", async (req, res) => {
  const record = await Record.findOne({
    _id: id.parse(req.params.id),
    businessId: req.auth.businessId,
  }).lean();
  assert(record, 404, "NOT_FOUND", "Transaction not found");
  assert(
    can(req.auth, permissionFor(record.kind)),
    403,
    "FORBIDDEN",
    "Permission required",
  );
  res.json(recordView(record));
});
app.post("/api/drafts", async (req, res) => {
  res
    .status(201)
    .json(
      await preview(
        req.auth,
        req.body,
        z.string().uuid().parse(req.headers["idempotency-key"]),
      ),
    );
});
app.get("/api/drafts/:id", async (req, res) => {
  const draft = await Draft.findOne({
    _id: id.parse(req.params.id),
    businessId: req.auth.businessId,
    userId: req.auth.userId,
  }).lean();
  assert(draft, 404, "DRAFT_NOT_FOUND", "Preview not found");
  res.json(draft);
});
app.patch("/api/drafts/:id", async (req, res) => {
  const input = tradeSchema.parse(req.body);
  assert(
    can(req.auth, permissionFor(input.kind)),
    403,
    "FORBIDDEN",
    "Permission required",
  );
  // Editing replaces the preview, avoiding a race with confirmation on the old draft.
  const old = await Draft.findOneAndUpdate(
    {
      _id: id.parse(req.params.id),
      businessId: req.auth.businessId,
      userId: req.auth.userId,
      status: "pending",
    },
    { $set: { status: "cancelled" } },
  );
  assert(
    old,
    409,
    "DRAFT_UNAVAILABLE",
    "This preview was already confirmed or cancelled",
  );
  res
    .status(201)
    .json(
      await preview(
        req.auth,
        input,
        z.string().uuid().parse(req.headers["idempotency-key"]),
      ),
    );
});
app.post("/api/drafts/:id/confirm", async (req, res) => {
  assert(
    req.body.confirm === true,
    422,
    "CONFIRM_REQUIRED",
    "Explicit confirmation is required",
  );
  res.json(await confirm(req.auth, id.parse(req.params.id)));
});
app.delete("/api/drafts/:id", async (req, res) => {
  const cancelled = await Draft.findOneAndUpdate(
    {
      _id: id.parse(req.params.id),
      businessId: req.auth.businessId,
      userId: req.auth.userId,
      status: "pending",
    },
    { $set: { status: "cancelled" } },
  );
  if (!cancelled) {
    const current = await Draft.findOne({
      _id: id.parse(req.params.id),
      businessId: req.auth.businessId,
      userId: req.auth.userId,
    }).lean();
    assert(current, 404, "DRAFT_NOT_FOUND", "Preview not found");
    assert(
      current.status !== "confirmed",
      409,
      "DRAFT_ALREADY_CONFIRMED",
      "This transaction was already saved. Open its existing record before creating another.",
    );
  }
  res.sendStatus(204);
});
app.post("/api/records/:id/reverse", authorize("owner"), async (req, res) => {
  const { reason } = z
    .object({ reason: z.string().trim().min(5).max(500) })
    .parse(req.body);
  await reverse(req.auth, id.parse(req.params.id), reason);
  res.sendStatus(204);
});
app.get("/api/inventory", async (req, res) => {
  const { page, limit } = pagination.parse(req.query);
  res.json(
    await inventory(
      req.auth.businessId,
      page,
      limit,
      id.optional().parse(req.query.productId),
    ),
  );
});
app.get("/api/inventory/products", async (req, res) => {
  res.json(await productStock(req.auth.businessId));
});
app.get("/api/inventory/:id/movements", async (req, res) => {
  const { page, limit } = pagination.parse(req.query);
  res.json(
    await Movement.find({
      businessId: req.auth.businessId,
      lotId: id.parse(req.params.id),
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  );
});
app.get("/api/prices", authorize("reports"), async (req, res) => {
  res.json(
    await priceHistory(
      req.auth.businessId,
      id.optional().parse(req.query.productId),
    ),
  );
});
app.get("/api/audit", authorize("owner"), async (req, res) => {
  const { page, limit } = pagination.parse(req.query);
  res.json(
    await Audit.find({ businessId: req.auth.businessId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  );
});
app.get("/api/reminders", async (req, res) => {
  res.json(
    await Record.find({
      businessId: req.auth.businessId,
      status: "posted",
      kind: { $in: ["purchase", "sale"] },
      dueDate: { $lte: indiaDate() },
      $expr: { $gt: ["$total", "$paid"] },
    })
      .sort({ dueDate: 1 })
      .limit(100)
      .lean(),
  );
});
app.use("/api/voice", ...voiceRateLimits(), voiceRouter);
app.use("/api/invoices", invoiceRouter);
app.use((_req, _res, next) =>
  next(new AppError(404, "NOT_FOUND", "Endpoint not found")),
);
const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Please check the highlighted fields",
        fields: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }
  if (error instanceof AppError) {
    if (error.code === "AI_INVALID_RESPONSE" && "reason" in error)
      logger.warn(
        { code: error.code, reason: error.reason },
        "AI response validation failed",
      );
    if (error.retryAfterSeconds !== undefined)
      res.set("Retry-After", String(error.retryAfterSeconds));
    res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(413).json({
      error: {
        code: "UPLOAD_LIMIT",
        message: "Recording exceeds the upload limit. Try a shorter recording",
      },
    });
    return;
  }
  if (error?.code === 11000) {
    res.status(409).json({
      error: {
        code: "DUPLICATE",
        message: "A record with these details already exists",
      },
    });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      error: { code: "INVALID_JSON", message: "Invalid JSON request" },
    });
    return;
  }
  logger.error(
    { code: error?.code ?? "INTERNAL_ERROR", name: error?.name ?? "Error" },
    "Request failed",
  );
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "The request could not be completed. Please retry.",
    },
  });
};
app.use(errors);
