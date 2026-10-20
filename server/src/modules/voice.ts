import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { mkdir, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { id, rupees } from "@tamiltrade/shared";
import { env } from "../config/env.js";
import { assert } from "../shared/errors.js";
import {
  Contact,
  Product,
  VoiceJob,
  Conversation,
  Record,
  User,
  QueueState,
} from "./models.js";
import { interpretCommand, type CommandContext } from "./command-ai.js";
import { speechSettings } from "../shared/speech-settings.js";
import { balance } from "./trading.js";
import {
  dashboard,
  priceHistory,
  inventory,
  salesSummary,
} from "./reporting.js";
import type { Principal } from "./auth.js";
import { nextVoiceQuestion, voiceSourceOptions } from "./voice-follow-up.js";
import { voiceWorkerStatus } from "../shared/voice-worker-lease.js";
export async function understand(
  auth: Pick<Principal, "businessId" | "userId">,
  text: string,
  selection: { contactId?: string } = {},
) {
  const scope = { businessId: auth.businessId };
  const [customers, suppliers, products, conversation] = await Promise.all([
    Contact.find({ ...scope, kind: "customer" })
      .select("name aliases")
      .sort({ name: 1 })
      .limit(35)
      .lean(),
    Contact.find({ ...scope, kind: "supplier" })
      .select("name aliases")
      .sort({ name: 1 })
      .limit(35)
      .lean(),
    Product.find(scope)
      .select("name unit weightGrams")
      .sort({ name: 1 })
      .limit(50)
      .lean(),
    Conversation.findOne({
      ...scope,
      userId: auth.userId,
      expiresAt: { $gt: new Date() },
    }).lean(),
  ]);
  const entities = (
    items: { _id: unknown; name: string; aliases?: string[] }[],
  ) => items.map((e) => ({ ...e, _id: String(e._id) }));
  const context: CommandContext = conversation
    ? {
        contactId: conversation.contactId?.toString(),
        purchaseId: conversation.purchaseId?.toString(),
        saleId: conversation.saleId?.toString(),
        pendingInput: conversation.pendingInput,
        pendingQuestion: conversation.pendingQuestion,
      }
    : {};
  // Supply only references that still belong to this business and are posted.
  const selectedRecords = await Record.find({
    ...scope,
    status: "posted",
    _id: {
      $in: [context.purchaseId, context.saleId].filter(Boolean),
    },
  })
    .select("kind")
    .lean();
  if (
    !selectedRecords.some(
      (record) =>
        String(record._id) === context.purchaseId && record.kind === "purchase",
    )
  )
    delete context.purchaseId;
  if (
    !selectedRecords.some(
      (record) =>
        String(record._id) === context.saleId && record.kind === "sale",
    )
  )
    delete context.saleId;
  if (selection.contactId)
    assert(
      await Contact.exists({ ...scope, _id: selection.contactId }),
      404,
      "NOT_FOUND",
      "Account not found",
    );
  const sources = context.pendingInput
    ? await voiceSourceOptions(
        auth.businessId,
        context.pendingInput,
        context.pendingQuestion?.field === "sourceId"
          ? (conversation?.pendingSourceIds ?? [])
          : [],
      )
    : [];
  const result = await interpretCommand(
    text,
    {
      customers: entities(customers),
      suppliers: entities(suppliers),
      products: entities(products),
      context,
      recentMessages: (conversation?.messages ?? [])
        .slice(-4)
        .map((message) => ({
          text: String(message.text).slice(0, 400),
          intent: String(message.intent),
        })),
      selectedContactId: selection.contactId,
      sources,
    },
    {
      apiKey: env.GROQ_API_KEY,
      model: env.COMMAND_AI_MODEL,
      timeoutMs: env.COMMAND_AI_TIMEOUT_MS,
      gemini:
        env.GEMINI_FALLBACK_ENABLED && env.GEMINI_API_KEY
          ? {
              apiKey: env.GEMINI_API_KEY,
              model: env.GEMINI_COMMAND_AI_MODEL,
            }
          : undefined,
    },
  );
  if (selection.contactId) {
    assert(
      result.intent === "GET_TRANSACTION_DETAILS",
      400,
      "INVALID_SELECTION",
      "Choose an account for a transaction-details question.",
    );
    const contact = await Contact.findOne({
      ...scope,
      _id: selection.contactId,
    })
      .select("name")
      .lean();
    assert(contact, 404, "NOT_FOUND", "Account not found");
    result.contactId = String(contact._id);
    result.input.contactId = result.contactId;
    result.candidates = [];
  }
  const user = await User.findOne({
    _id: auth.userId,
    businessId: auth.businessId,
    active: true,
  }).lean();
  assert(user, 401, "SESSION_EXPIRED", "Account is unavailable");
  const intentPermission = result.intent.startsWith("GET_")
    ? "reports"
    : result.intent.includes("INVOICE")
      ? "invoices"
      : result.input.kind === "purchase"
        ? "purchases"
        : result.input.kind === "sale"
          ? "sales"
          : result.input.kind === "expense"
            ? "expenses"
            : result.input.kind?.endsWith("payment")
              ? "payments"
              : undefined;
  assert(
    !intentPermission ||
      user.role === "owner" ||
      user.permissions.includes(intentPermission),
    403,
    "FORBIDDEN",
    "Your account does not have permission for this command",
  );
  let answer: unknown;
  if (result.clarification.length > 0) {
    // Resolve model uncertainty before reading any business answer.
  } else if (
    result.intent === "GET_CUSTOMER_BALANCE" ||
    result.intent === "GET_SUPPLIER_BALANCE"
  ) {
    if (result.contactId) {
      const outstanding = await balance(auth.businessId, result.contactId);
      answer = { balance: outstanding, text: `பாக்கி: ${rupees(outstanding)}` };
    } else
      result.clarification.push(
        "Select the customer or supplier to check their balance.",
      );
  } else if (result.intent === "GET_STOCK")
    answer = await inventory(auth.businessId, 1, 50, result.input.productId);
  else if (result.intent === "GET_DAILY_SALES")
    answer = await salesSummary(auth.businessId, {
      date: result.query.date,
      from: result.query.from,
      to: result.query.to,
      contactId: result.contactId,
      productId: result.input.productId,
    });
  else if (["GET_PROFIT", "GET_MONTHLY_REPORT"].includes(result.intent)) {
    const data = await dashboard(auth.businessId);
    const recentSale =
      result.intent === "GET_PROFIT" &&
      context.saleId &&
      result.query.scope === "selected_sale"
        ? await Record.findOne({
            ...scope,
            _id: context.saleId,
            kind: "sale",
            status: "posted",
          }).lean()
        : null;
    answer =
      result.intent === "GET_PROFIT"
        ? recentSale
          ? {
              grossProfit: recentSale.total - recentSale.tax - recentSale.cost,
              text: `இந்த விற்பனையின் மொத்த லாபம்: ${rupees(recentSale.total - recentSale.tax - recentSale.cost)}. Operating expenses are excluded.`,
              saleId: String(recentSale._id),
              period: "selected sale",
            }
          : {
              grossProfit: data.grossProfit,
              operatingExpenses: data.operatingExpenses,
              netProfit: data.monthlyProfit,
              period: "current month",
              valuation:
                "Specific purchase lot, inclusive tax; no assumed input tax credit",
            }
        : data;
  } else if (result.intent === "GET_TRANSACTION_DETAILS") {
    if (!result.contactId) {
      result.clarification.push(
        result.candidates.length
          ? "Choose the account below to look up its saved transactions."
          : "Which saved customer or supplier do you mean? Enter their saved name or add the spelling you use as an alias.",
      );
    } else if (result.clarification.includes("Choose the correct product.")) {
      result.clarification.push(
        "Enter the saved product name to narrow this lookup.",
      );
    } else {
      const contact = await Contact.findOne({ ...scope, _id: result.contactId })
        .select("name")
        .lean();
      const rows = await Record.find({
        ...scope,
        contactId: result.contactId,
        status: "posted",
        ...(result.query?.kind ? { kind: result.query.kind } : {}),
        ...(result.query?.date ? { date: result.query.date } : {}),
        ...(!result.query.date && (result.query.from || result.query.to)
          ? {
              date: {
                ...(result.query.from ? { $gte: result.query.from } : {}),
                ...(result.query.to ? { $lte: result.query.to } : {}),
              },
            }
          : {}),
        ...(result.input.productId
          ? { productId: result.input.productId }
          : {}),
      })
        .sort({ date: -1, createdAt: -1, _id: -1 })
        .limit(20)
        .lean();
      answer = {
        contactId: result.contactId,
        contactName: contact?.name,
        filteredKind: result.query?.kind,
        text: rows.length
          ? `${contact?.name}: ${rows.length} matching saved transaction${rows.length === 1 ? "" : "s"}${rows.length === 20 ? " (latest 20)" : ""}.`
          : `No matching saved ${result.query?.kind === "sale" ? "sales" : result.query?.kind === "purchase" ? "purchases" : "transactions"} for ${contact?.name}${result.query?.date ? ` on ${result.query.date}` : ""}. Check the account, transaction type and product.`,
        records: rows.map((row) => ({
          _id: String(row._id),
          kind: row.kind,
          date: row.date,
          productName: row.productName,
          quantity: row.quantity,
          unitPrice: row.input.unitPrice,
          total: row.total,
          paid: row.paid,
        })),
      };
    }
  } else if (result.intent === "GET_PRICE_HISTORY") {
    const prices = await priceHistory(
      auth.businessId,
      result.input.productId,
      result.contactId,
    );
    answer = {
      prices,
      text: prices.length
        ? `Latest recorded purchase: ${prices[0]!.supplier} · ${prices[0]!.product} · ₹${prices[0]!.unitPrice} / configured unit · ${prices[0]!.date}`
        : "No matching recorded prices found.",
    };
  } else if (
    result.intent === "GET_PURCHASE_HISTORY" ||
    result.intent === "GET_CUSTOMER_HISTORY"
  )
    answer = await Record.find({
      ...scope,
      ...(result.intent === "GET_PURCHASE_HISTORY"
        ? { kind: "purchase" }
        : result.contactId
          ? { contactId: result.contactId }
          : { _id: null }),
    })
      .sort({ date: -1 })
      .limit(20)
      .lean();
  else if (
    result.intent === "CREATE_INVOICE_DRAFT" ||
    result.intent === "SHARE_INVOICE"
  ) {
    const sale = context.saleId
      ? await Record.findOne({
          ...scope,
          _id: context.saleId,
          kind: "sale",
          status: "posted",
        }).lean()
      : null;
    if (
      sale &&
      (!result.contactId || result.contactId === String(sale.contactId))
    )
      answer = {
        saleId: String(sale._id),
        text: "Review this sale in Invoices before issuing or sharing.",
      };
    else result.clarification.push("Select the sale to invoice.");
  }
  const nextSources =
    result.input.kind && result.missing.includes("sourceId")
      ? await voiceSourceOptions(auth.businessId, result.input)
      : sources;
  const question = nextVoiceQuestion(
    result,
    {
      customers: entities(customers),
      suppliers: entities(suppliers),
      products: entities(products),
    },
    nextSources,
  );
  const followUp = question ? { id: randomUUID(), ...question } : undefined;
  const selectedSource =
    result.input.kind && result.input.sourceId
      ? await Record.findOne({
          ...scope,
          _id: result.input.sourceId,
          status: "posted",
        })
          .select("date contactName productName")
          .lean()
      : null;
  const summary = result.input.kind
    ? {
        contactName: [...customers, ...suppliers].find(
          (contact) => String(contact._id) === result.input.contactId,
        )?.name,
        productName: products.find(
          (product) => String(product._id) === result.input.productId,
        )?.name,
        sourceLabel:
          nextSources.find((source) => source._id === result.input.sourceId)
            ?.label ??
          (selectedSource
            ? [
                selectedSource.date,
                selectedSource.contactName,
                selectedSource.productName,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined),
      }
    : undefined;
  const update: Record<string, unknown> = {
    expiresAt: new Date(Date.now() + 30 * 60000),
  };
  if (result.contactId) {
    update.contactId = result.contactId;
    if (result.contactId !== context.contactId) update.saleId = null;
  }
  if (result.intent === "CANCEL_PENDING_ACTION") {
    update.pendingInput = null;
    update.pendingQuestion = null;
    update.pendingSourceIds = [];
    answer = { text: "Draft cancelled. Nothing was saved." };
  } else if (result.input.kind) {
    update.pendingInput = result.input;
    update.pendingQuestion = followUp ?? null;
    update.pendingSourceIds =
      followUp?.field === "sourceId"
        ? nextSources.map((source) => source._id)
        : [];
  }
  await Conversation.findOneAndUpdate(
    { ...scope, userId: auth.userId },
    {
      $set: update,
      $push: {
        messages: {
          $each: [{ text, intent: result.intent, at: new Date() }],
          $slice: -30,
        },
      },
    },
    { upsert: true },
  );
  return { ...result, answer, followUp, summary };
}
export const voiceRouter = Router();
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    mkdir(env.VOICE_STORAGE_PATH, { recursive: true }).then(
      () => cb(null, env.VOICE_STORAGE_PATH),
      (error) => cb(error, ""),
    );
  },
  filename: (_req, _file, cb) => cb(null, randomUUID() + ".audio"),
});
const upload = multer({
  storage,
  limits: {
    fileSize: env.VOICE_MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
    fields: 2,
  },
  fileFilter: (_req, file, cb) => {
    cb(
      null,
      [
        "audio/mp4",
        "audio/m4a",
        "audio/x-m4a",
        "audio/wav",
        "audio/x-wav",
        "audio/mpeg",
        "audio/webm",
        "audio/aac",
      ].includes(file.mimetype),
    );
  },
});
voiceRouter.get("/config", async (_req, res) => {
  res.json({
    ...speechSettings(env),
    understanding: {
      provider: "groq",
      model: env.COMMAND_AI_MODEL,
      ready: Boolean(env.GROQ_API_KEY),
      fallback: {
        provider: "gemini",
        model: env.GEMINI_COMMAND_AI_MODEL,
        enabled: env.GEMINI_FALLBACK_ENABLED,
        ready: env.GEMINI_FALLBACK_ENABLED && Boolean(env.GEMINI_API_KEY),
      },
    },
    worker: await voiceWorkerStatus(),
  });
});
voiceRouter.post("/text", async (req, res) => {
  const { text, contactId } = z
    .object({
      text: z.string().trim().min(1).max(2000),
      contactId: id.optional(),
    })
    .parse(req.body);
  res.json(await understand(req.auth, text, { contactId }));
});
voiceRouter.get("/history", async (req, res) => {
  const data = await Conversation.findOne({
    businessId: req.auth.businessId,
    userId: req.auth.userId,
    expiresAt: { $gt: new Date() },
  })
    .select("messages")
    .lean();
  res.json(data?.messages ?? []);
});
voiceRouter.delete("/context", async (req, res) => {
  await Conversation.deleteOne({
    businessId: req.auth.businessId,
    userId: req.auth.userId,
  });
  res.sendStatus(204);
});
voiceRouter.post(
  "/jobs",
  (_req, _res, next) => {
    assert(
      speechSettings(env).ready,
      503,
      "SPEECH_NOT_CONFIGURED",
      "Cloud speech is not configured yet. Ask the owner to finish speech setup, or type your command.",
    );
    assert(
      Boolean(env.GROQ_API_KEY),
      503,
      "AI_NOT_CONFIGURED",
      "AI command understanding is not configured. Ask the owner to add the Groq key, or enter the transaction manually.",
    );
    next();
  },
  upload.single("audio"),
  async (req, res) => {
    let retained = false;
    try {
      assert(
        req.file,
        400,
        "AUDIO_REQUIRED",
        "Upload a supported audio recording",
      );
      const key = z.string().uuid().parse(req.headers["idempotency-key"]);
      const scope = {
        businessId: req.auth.businessId,
        userId: req.auth.userId,
        key,
      };
      const existing = await VoiceJob.findOne(scope).lean();
      if (existing) {
        res.json(existing);
        return;
      }
      assert(
        (await voiceWorkerStatus()).online,
        503,
        "VOICE_WORKER_OFFLINE",
        "Speech processing is offline. Your recording is kept on this device. Try again when processing is available, or type your command.",
      );
      // Validate container signatures, then ffprobe validates actual duration/content in worker.
      const header = (await readFile(req.file.path)).subarray(0, 16);
      assert(
        header.length >= 12,
        415,
        "INVALID_AUDIO",
        "The uploaded audio file is too short",
      );
      const valid =
        header.toString("ascii", 4, 8) === "ftyp" ||
        header.toString("ascii", 0, 4) === "RIFF" ||
        header.readUInt32BE(0) === 0x1a45dfa3 ||
        header.toString("ascii", 0, 3) === "ID3" ||
        header[0] === 0xff;
      assert(
        valid,
        415,
        "INVALID_AUDIO",
        "The uploaded file is not a supported audio container",
      );
      const filePath = path.resolve(req.file.path);
      const job = await mongoose.connection.transaction(async (session) => {
        await QueueState.updateOne(
          { _id: "voice" },
          { $inc: { version: 1 } },
          { session },
        );
        assert(
          (await VoiceJob.countDocuments({
            status: { $in: ["queued", "transcribing", "understanding"] },
          }).session(session)) < env.VOICE_QUEUE_LIMIT,
          503,
          "VOICE_BUSY",
          "Speech queue is busy. Try again shortly or type your command",
        );
        const [created] = await VoiceJob.create(
          [
            {
              ...scope,
              path: filePath,
              expiresAt: new Date(Date.now() + 86400000),
            },
          ],
          { session },
        );
        return created!;
      });
      retained = true;
      res.status(202).json({ _id: job._id, status: job.status });
    } finally {
      if (req.file && !retained) await rm(req.file.path, { force: true });
    }
  },
);
voiceRouter.get("/jobs/:id", async (req, res) => {
  const job = await VoiceJob.findOne({
    _id: id.parse(req.params.id),
    businessId: req.auth.businessId,
    userId: req.auth.userId,
  }).lean();
  assert(job, 404, "NOT_FOUND", "Voice job not found");
  res.json({
    ...job,
    ...(job.status === "queued"
      ? {
          queue: {
            workerOnline: (await voiceWorkerStatus()).online,
            waitedSeconds: Math.max(
              0,
              Math.floor((Date.now() - job.createdAt.getTime()) / 1000),
            ),
          },
        }
      : {}),
  });
});
voiceRouter.delete("/jobs/:id", async (req, res) => {
  const job = await VoiceJob.findOneAndUpdate(
    {
      _id: id.parse(req.params.id),
      businessId: req.auth.businessId,
      userId: req.auth.userId,
      status: { $in: ["queued", "transcribing", "understanding"] },
    },
    { $set: { status: "cancelled" } },
  ).select("+path");
  if (job?.status === "queued" && job.path) await rm(job.path, { force: true });
  res.sendStatus(204);
});
