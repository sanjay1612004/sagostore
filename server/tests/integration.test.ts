import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import type { CommandPlan } from "../src/modules/command-ai.js";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { Express } from "express";
import { indiaDate } from "@tamiltrade/shared";
// Request budgets have their own HTTP tests. Keep this growing acceptance
// scenario independent of the number of command requests it exercises.
vi.mock("../src/shared/voice-rate-limits.js", () => ({
  voiceRateLimits: () => [
    (_req: unknown, _res: unknown, next: () => void) => next(),
  ],
}));
let replica: MongoMemoryReplSet;
let app: Express;
let owner: string, other: string, refresh: string;
let supplier: string,
  customer: string,
  product: string,
  purchase: string,
  sale: string,
  invoice: string;
const bearer = (token = owner) => ({ Authorization: `Bearer ${token}` });
async function postDraft(input: object, token = owner) {
  const r = await request(app)
    .post("/api/drafts")
    .set({ ...bearer(token), "Idempotency-Key": randomUUID() })
    .send(input);
  expect(r.status, r.text).toBe(201);
  return r.body._id as string;
}
async function commit(draft: string, token = owner) {
  return request(app)
    .post(`/api/drafts/${draft}/confirm`)
    .set(bearer(token))
    .send({ confirm: true });
}
const base = { date: "2026-10-16", delivery: "warehouse" };
beforeAll(async () => {
  // Controlled provider responses test the HTTP/DB integration, not model accuracy.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      if (
        !String(url).startsWith(
          "https://api.groq.com/openai/v1/chat/completions",
        )
      )
        throw Error("Unexpected test network request");
      const payload = JSON.parse(String(options.body));
      const request = JSON.parse(
        payload.messages.find(
          (message: { role: string }) => message.role === "user",
        ).content,
      );
      const customerId = request.customers[0]?._id;
      const supplierId = request.suppliers[0]?._id;
      const productId = request.products[0]?._id;
      if (request.command === "Show me all the transaction of Ramesh Store.") {
        return Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: JSON.stringify({
                  intent: "GET_TRANSACTION_DETAILS",
                  input: {
                    contactName: request.customers[0]?.name,
                    contactId: null,
                    productId: null,
                    productName: null,
                    sourceId: null,
                    quantity: null,
                    date: null,
                    unitPrice: null,
                  },
                  query: {
                    kind: null,
                    date: null,
                    from: null,
                    to: null,
                    scope: null,
                  },
                  candidateContactIds: [],
                  clarification: [],
                }),
              },
            },
          ],
        });
      }
      const fixtures: Record<string, Partial<CommandPlan>> = {
        "Add Voice Demo Mill as supplier phone 09876543210": {
          intent: "CREATE_SUPPLIER",
          input: {
            name: "Voice Demo Mill",
            contactName: "Voice Demo Mill",
            phone: "09876543210",
            paymentTermsDays: 15,
          },
        },
        "Correct phone to +919876543210": {
          intent: "UPDATE_PENDING_DRAFT",
          input: { phone: "+919876543210" },
        },
        "Voice Demo Customer, 09876543211, credit limit 2500": {
          intent: "UPDATE_PENDING_DRAFT",
          input: {
            name: "Voice Demo Customer",
            contactName: "Voice Demo Customer",
            phone: "09876543211",
            creditLimit: "2500",
            address: "Salem",
            aliases: ["மாதிரி கடை"],
          },
        },
        "Add Rice Demo product": {
          intent: "CREATE_PRODUCT",
          input: { name: "Rice Demo", productName: "Rice Demo" },
        },
        "Trading unit bag": {
          intent: "UPDATE_PENDING_DRAFT",
          input: { unit: "bag" },
        },
        "25 kilograms per bag, low stock 5": {
          intent: "UPDATE_PENDING_DRAFT",
          input: { weightGrams: 25000, lowStockQuantity: 5 },
        },
        "Cancel the catalog entry": {
          intent: "CANCEL_PENDING_ACTION",
          input: {},
        },
        "Start a purchase from ABC Mill for Sago": {
          intent: "CREATE_PURCHASE",
          input: { contactId: supplierId, productId },
        },
        "pathu mootai": {
          intent: "UPDATE_PENDING_DRAFT",
          input: { quantity: 10 },
        },
        "3200 per bag": {
          intent: "UPDATE_PENDING_DRAFT",
          input: { unitPrice: "3200" },
        },
        "New sale to Ramesh, ten bags Sago at 3500": {
          intent: "CREATE_SALE",
          input: {
            contactId: customerId,
            productId,
            quantity: 10,
            unitPrice: "3500",
          },
        },
        "first option": {
          intent: "UPDATE_PENDING_DRAFT",
          input: { sourceOption: 1 },
        },
        "cancel this draft": { intent: "CANCEL_PENDING_ACTION", input: {} },
        "Sale with unusable AI references": {
          intent: "CREATE_SALE",
          input: {
            contactId: "f".repeat(24),
            productId,
            sourceId: "e".repeat(24),
            quantity: 100,
            unitPrice: "1000",
          },
        },
        "stock எவ்வளவு?": { intent: "GET_STOCK", input: {} },
        "ஸ்டாக் எவ்வளவு இருக்கு?": {
          intent: "GET_STOCK",
          input: { aliases: [] },
        },
        "How much sales has happened today?": {
          intent: "GET_DAILY_SALES",
          input: { date: indiaDate() },
          query: { date: indiaDate(), kind: "sale" },
        },
        "ABC Mill la irundhu aimbathu mootai Sago vaanginen. oru mootaiyoda vilai vandhu 3200 rupees. lorry vadagai rendaayirathu ainuru":
          {
            intent: "CREATE_PURCHASE",
            input: {
              contactId: supplierId,
              productId,
              quantity: 50,
              unitPrice: "3200",
              transport: "2500",
            },
          },
        "Ramesh Store ku pathu mootai Sago kuduthen oru moottai vilai 3000 rupees":
          {
            intent: "CREATE_SALE",
            input: {
              contactId: customerId,
              productId,
              quantity: 10,
              unitPrice: "3000",
            },
          },
        "ரமேஷ் பாக்கி எவ்வளவு?": {
          intent: "GET_CUSTOMER_BALANCE",
          input: { contactId: customerId },
        },
        "ரமேஷ் எவ்வளோ மூட்டை கொடுத்தேன் அதோட விலை என்ன details கொடு": {
          intent: "GET_TRANSACTION_DETAILS",
          input: { contactId: customerId },
          query: { kind: "sale" },
        },
        "Rameshukku evlo mootai kuduthen details kaattu":
          request.selectedContactId
            ? {
                intent: "GET_TRANSACTION_DETAILS",
                input: { contactId: request.selectedContactId },
                query: { kind: "sale" },
              }
            : {
                intent: "GET_TRANSACTION_DETAILS",
                input: {},
                query: { kind: "sale" },
                candidateContactIds: [customerId],
                clarification: [
                  "Choose the correct account. The name match is uncertain.",
                ],
              },
        "ABC Mill ku evlo mootai kuduthen details kaattu": {
          intent: "GET_TRANSACTION_DETAILS",
          input: { contactId: supplierId },
          query: { kind: "sale" },
        },
        "transaction details": {
          intent: "GET_TRANSACTION_DETAILS",
          input: { contactId: request.selectedContactId },
          query: {},
        },
        "Ramesh Store 2001-01-01 transaction details": {
          intent: "GET_TRANSACTION_DETAILS",
          input: { contactId: customerId },
          query: { date: "2001-01-01" },
        },
        "இந்த வியாபாரத்துல லாபம் எவ்வளவு?": {
          intent: "GET_PROFIT",
          input: {},
          query: { scope: "selected_sale" },
        },
        "intha viyabarathula laabam evlo?": {
          intent: "GET_PROFIT",
          input: {},
          query: { scope: "selected_sale" },
        },
      };
      if (request.command === "simulate free quota exhausted")
        return new Response("secret provider details", {
          status: 429,
          headers: { "retry-after": "0" },
        });
      const fixture = fixtures[request.command];
      if (!fixture) throw Error("No AI test fixture for command");
      const plan = {
        intent: "UNKNOWN",
        input: {},
        query: {},
        candidateContactIds: [],
        clarification: [],
        ...fixture,
      };
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { role: "assistant", content: JSON.stringify(plan) },
          },
        ],
      });
    }),
  );
  replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "7.0.24" },
  });
  Object.assign(process.env, {
    NODE_ENV: "test",
    MONGODB_URI: replica.getUri(),
    JWT_ACCESS_SECRET: "test-access-".repeat(6),
    JWT_REFRESH_SECRET: "test-refresh-".repeat(6),
    REGISTRATION_ENABLED: "true",
    LOG_LEVEL: "silent",
    GROQ_API_KEY: "private-groq-integration-key",
  });
  const models = await import("../src/modules/models.js");
  await models.connectDatabase(process.env.MONGODB_URI!);
  await models.ensureIndexes();
  app = (await import("../src/app.js")).app;
  const a = await request(app).post("/auth/register").send({
    email: "owner@example.com",
    password: "Testing-password-123",
    name: "Owner",
    businessName: "Shri Sai Ganesh Stores",
  });
  expect(a.status, a.text).toBe(201);
  owner = a.body.accessToken;
  refresh = a.body.refreshToken;
  const b = await request(app).post("/auth/register").send({
    email: "other@example.com",
    password: "Testing-password-123",
    name: "Other Owner",
    businessName: "Other Store",
  });
  other = b.body.accessToken;
}, 180000);
afterAll(async () => {
  await mongoose.disconnect();
  await replica?.stop();
  vi.unstubAllGlobals();
}, 30000);
describe.sequential("transactional business acceptance scenario", () => {
  it("switches an HTTP command to Gemini on quota exhaustion without making financial writes", async () => {
    const { env } = await import("../src/config/env.js");
    const { Record, Draft } = await import("../src/modules/models.js");
    const previous = {
      GROQ_API_KEY: env.GROQ_API_KEY,
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      GEMINI_FALLBACK_ENABLED: env.GEMINI_FALLBACK_ENABLED,
    };
    const originalFetch = globalThis.fetch;
    const providerFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { "retry-after": "60" } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                role: "model",
                parts: [
                  {
                    text: JSON.stringify({
                      intent: "GET_STOCK",
                      input: {},
                      query: {},
                      candidateContactIds: [],
                      clarification: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    const recordCount = await Record.countDocuments();
    const draftCount = await Draft.countDocuments();
    try {
      env.GROQ_API_KEY = "quota-fallback-fictional-primary";
      env.GEMINI_API_KEY = "quota-fallback-fictional-backup";
      env.GEMINI_FALLBACK_ENABLED = true;
      vi.stubGlobal("fetch", providerFetch);
      const config = await request(app).get("/api/voice/config").set(bearer());
      expect(config.body.understanding.fallback).toMatchObject({
        provider: "gemini",
        enabled: true,
        ready: true,
      });
      expect(config.text).not.toContain(env.GEMINI_API_KEY);
      const result = await request(app)
        .post("/api/voice/text")
        .set(bearer())
        .send({ text: "stock evlo?" });
      expect(result.status, result.text).toBe(200);
      expect(result.body.understanding).toMatchObject({
        provider: "gemini",
        fallback: true,
      });
      expect(result.body.intent).toBe("GET_STOCK");
      expect(providerFetch).toHaveBeenCalledTimes(2);
      expect(await Record.countDocuments()).toBe(recordCount);
      expect(await Draft.countDocuments()).toBe(draftCount);
    } finally {
      Object.assign(env, previous);
      vi.stubGlobal("fetch", originalFetch);
    }
  });
  it("recovers real model writes after a force-closed pool without resetting the API connection", async () => {
    const { resetWorkerDatabaseConnection } =
      await import("../src/shared/worker-database.js");
    const uri = replica.getUri();
    const connection = await mongoose.createConnection(uri).asPromise();
    const Probe = connection.model(
      "WorkerRecoveryProbe",
      new mongoose.Schema({ value: Number }),
    );
    try {
      const created = await Probe.create({ value: 1 });
      await connection.close(true);
      await connection.openUri(uri);
      // Reproduces the old recovery path: connected driver, unusable models.
      expect(connection.readyState).toBe(1);
      await expect(Probe.findById(created._id).lean()).rejects.toThrow(
        "Connection was force closed",
      );
      await resetWorkerDatabaseConnection(connection);
      await connection.openUri(uri);
      await Probe.updateOne({ _id: created._id }, { $set: { value: 2 } });
      expect((await Probe.findById(created._id).lean())?.value).toBe(2);
      expect(mongoose.connection.readyState).toBe(1);
    } finally {
      await connection.close(false);
    }
  });
  it("distinguishes an absent speech worker from a busy live worker without exposing recordings", async () => {
    const { QueueState, VoiceJob, User } =
      await import("../src/modules/models.js");
    const { voiceWorkerStatus, publishVoiceWorkerHeartbeat } =
      await import("../src/shared/voice-worker-lease.js");
    const { env } = await import("../src/config/env.js");
    const previous = {
      SPEECH_ENGINE: env.SPEECH_ENGINE,
      SARVAM_API_KEY: env.SARVAM_API_KEY,
    };
    const user = await User.findOne({ email: "owner@example.com" }).lean();
    const workerId = randomUUID();
    const queued = await VoiceJob.create({
      businessId: user!.businessId,
      userId: user!._id,
      key: randomUUID(),
      path: "/tmp/fictional-queued-audio",
      expiresAt: new Date(Date.now() + 60000),
    });
    try {
      env.SPEECH_ENGINE = "sarvam";
      env.SARVAM_API_KEY = "private-test-key";
      expect((await voiceWorkerStatus()).online).toBe(false);
      const offline = await request(app)
        .get(`/api/voice/jobs/${queued._id}`)
        .set(bearer());
      expect(offline.body.status).toBe("queued");
      expect(offline.body.queue.workerOnline).toBe(false);
      expect(offline.body.path).toBeUndefined();
      const config = await request(app).get("/api/voice/config").set(bearer());
      expect(config.body.worker.online).toBe(false);
      const upload = await request(app)
        .post("/api/voice/jobs")
        .set({ ...bearer(), "Idempotency-Key": randomUUID() })
        .attach(
          "audio",
          Buffer.from([
            0, 0, 0, 16, 102, 116, 121, 112, 77, 52, 65, 32, 0, 0, 0, 0,
          ]),
          { filename: "test.m4a", contentType: "audio/mp4" },
        );
      expect(upload.status, upload.text).toBe(503);
      expect(upload.body.error.code).toBe("VOICE_WORKER_OFFLINE");
      expect(await VoiceJob.countDocuments()).toBe(1);
      // Accepted-job retries still return that same job even while offline.
      const retry = await request(app)
        .post("/api/voice/jobs")
        .set({ ...bearer(), "Idempotency-Key": queued.key })
        .attach("audio", Buffer.from("ignored retry"), {
          filename: "test.m4a",
          contentType: "audio/mp4",
        });
      expect(retry.status).toBe(200);
      expect(retry.body._id).toBe(String(queued._id));
      await publishVoiceWorkerHeartbeat(workerId);
      const online = await request(app)
        .get(`/api/voice/jobs/${queued._id}`)
        .set(bearer());
      expect(online.body.queue.workerOnline).toBe(true);
      expect(online.body.status).toBe("queued");
      await QueueState.updateOne(
        { _id: "voice" },
        { $set: { heartbeatAt: new Date(Date.now() - 21000) } },
      );
      expect((await voiceWorkerStatus()).online).toBe(false);
    } finally {
      Object.assign(env, previous);
      await VoiceJob.deleteOne({ _id: queued._id });
      await QueueState.updateOne(
        { _id: "voice" },
        { $unset: { heartbeatAt: 1, heartbeatOwner: 1 } },
      );
    }
  });
  it("recovers an owned voice lease while excluding a different worker", async () => {
    const { QueueState } = await import("../src/modules/models.js");
    const { acquireVoiceWorkerLease } =
      await import("../src/shared/voice-worker-lease.js");
    const firstWorker = randomUUID(),
      secondWorker = randomUUID();
    try {
      expect(
        (await acquireVoiceWorkerLease(firstWorker, 60000))?.leaseOwner,
      ).toBe(firstWorker);
      expect(await acquireVoiceWorkerLease(secondWorker, 60000)).toBeNull();
      // A reconnecting process keeps its identity even when the prior release failed.
      expect(
        (await acquireVoiceWorkerLease(firstWorker, 60000))?.leaseOwner,
      ).toBe(firstWorker);
      await QueueState.updateOne(
        { _id: "voice" },
        { $set: { leaseUntil: new Date(0) } },
      );
      expect(
        (await acquireVoiceWorkerLease(secondWorker, 60000))?.leaseOwner,
      ).toBe(secondWorker);
      expect(await acquireVoiceWorkerLease(firstWorker, 60000)).toBeNull();
    } finally {
      await QueueState.updateOne(
        { _id: "voice" },
        { $unset: { leaseOwner: 1, leaseUntil: 1 } },
      );
    }
  });
  it("reports AI configuration and quota errors without falling back to a phrase parser", async () => {
    const { env } = await import("../src/config/env.js");
    const key = env.GROQ_API_KEY;
    try {
      env.GROQ_API_KEY = "";
      const missing = await request(app)
        .post("/api/voice/text")
        .set(bearer())
        .send({ text: "stock எவ்வளவு?" });
      expect(missing.status).toBe(503);
      expect(missing.body.error.code).toBe("AI_NOT_CONFIGURED");
    } finally {
      env.GROQ_API_KEY = key;
    }
    const quota = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "simulate free quota exhausted" });
    expect(quota.status).toBe(429);
    expect(quota.body.error.code).toBe("AI_RATE_LIMIT");
    expect(quota.text).not.toContain("secret provider details");
  });
  it("exposes cloud readiness without credentials and rejects unconfigured uploads before storing files", async () => {
    const { env } = await import("../src/config/env.js");
    const previous = {
      SPEECH_ENGINE: env.SPEECH_ENGINE,
      SARVAM_API_KEY: env.SARVAM_API_KEY,
    };
    try {
      env.SPEECH_ENGINE = "sarvam";
      env.SARVAM_API_KEY = "private-configuration-test-key";
      const config = await request(app).get("/api/voice/config").set(bearer());
      expect(config.status).toBe(200);
      expect(config.body).toMatchObject({
        provider: "sarvam",
        ready: true,
        maxDurationSeconds: 30,
        understanding: { provider: "groq", ready: true },
      });
      expect(config.text).not.toContain(env.SARVAM_API_KEY);
      expect(config.text).not.toContain(env.GROQ_API_KEY);
      env.SARVAM_API_KEY = "";
      const upload = await request(app)
        .post("/api/voice/jobs")
        .set({ ...bearer(), "Idempotency-Key": randomUUID() })
        .attach("audio", Buffer.from("not processed"), {
          filename: "command.m4a",
          contentType: "audio/mp4",
        });
      expect(upload.status).toBe(503);
      expect(upload.body.error.code).toBe("SPEECH_NOT_CONFIGURED");
      const typed = await request(app)
        .post("/api/voice/text")
        .set(bearer())
        .send({ text: "How much sales has happened today?" });
      expect(typed.status, typed.text).toBe(200);
      expect(typed.body.intent).toBe("GET_DAILY_SALES");
      expect(typed.body.clarification).toEqual([]);
      expect(typed.body.answer.salesTotal).toBe(0);
      expect(typed.body.answer.salesCount).toBe(0);
    } finally {
      Object.assign(env, previous);
    }
  });
  it("creates isolated contacts and configurable products", async () => {
    const a = await request(app)
      .post("/api/contacts")
      .set(bearer())
      .send({ name: "ABC Mill", kind: "supplier", aliases: ["ABC மில்லு"] });
    expect(a.status, a.text).toBe(201);
    supplier = a.body._id;
    const b = await request(app)
      .post("/api/contacts")
      .set(bearer())
      .send({ name: "Ramesh Store", kind: "customer", aliases: ["ரமேஷ்"] });
    expect(b.status, b.text).toBe(201);
    customer = b.body._id;
    const p = await request(app)
      .post("/api/products")
      .set(bearer())
      .send({ name: "Sago", unit: "bag", weightGrams: 50000 });
    expect(p.status, p.text).toBe(201);
    product = p.body._id;
    expect(
      (
        await request(app)
          .get("/api/contacts/" + customer)
          .set(bearer(other))
      ).status,
    ).toBe(404);
  });
  it("interprets Tanglish through the API without creating financial records or previews", async () => {
    const { Record, Draft, Movement } =
      await import("../src/modules/models.js");
    const counts = () =>
      Promise.all([
        Record.countDocuments(),
        Draft.countDocuments(),
        Movement.countDocuments(),
      ]);
    const before = await counts();
    const purchaseCommand = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({
        text: "ABC Mill la irundhu aimbathu mootai Sago vaanginen. oru mootaiyoda vilai vandhu 3200 rupees. lorry vadagai rendaayirathu ainuru",
      });
    expect(purchaseCommand.status, purchaseCommand.text).toBe(200);
    expect(purchaseCommand.body.intent).toBe("CREATE_PURCHASE");
    expect(purchaseCommand.body.input).toMatchObject({
      kind: "purchase",
      quantity: 50,
      unitPrice: "3200",
      transport: "2500",
      contactId: supplier,
      productId: product,
    });
    expect(purchaseCommand.body.canPreview).toBe(true);
    const saleCommand = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({
        text: "Ramesh Store ku pathu mootai Sago kuduthen oru moottai vilai 3000 rupees",
      });
    expect(saleCommand.status, saleCommand.text).toBe(200);
    expect(saleCommand.body.intent).toBe("CREATE_SALE");
    expect(saleCommand.body.input).toMatchObject({
      quantity: 10,
      unitPrice: "3000",
      contactId: customer,
      productId: product,
    });
    expect(saleCommand.body.canPreview).toBe(false);
    expect(saleCommand.body.missing).toContain("sourceId");
    expect(await counts()).toEqual(before);
  });
  it("requires explicit confirmation and commits a purchase once under concurrent retries", async () => {
    const draft = await postDraft({
      ...base,
      kind: "purchase",
      contactId: supplier,
      productId: product,
      quantity: 50,
      unitPrice: "3200",
      transport: "2500",
    });
    expect(
      (await request(app).get("/api/inventory").set(bearer())).body.total,
    ).toBe(0);
    expect(
      (
        await request(app)
          .post(`/api/drafts/${draft}/confirm`)
          .set(bearer())
          .send({})
      ).status,
    ).toBe(422);
    const [a, b] = await Promise.all([commit(draft), commit(draft)]);
    expect(a.status, a.text).toBe(200);
    expect(b.status, b.text).toBe(200);
    expect(a.body._id).toBe(b.body._id);
    purchase = a.body._id;
    expect(a.body.total).toBe(16250000);
    expect(
      (await request(app).get("/api/inventory").set(bearer())).body.items[0]
        .availableQuantity,
    ).toBe(50);
  });
  it("collects missing details across spoken-reply transcripts without posting or creating previews", async () => {
    const { understand } = await import("../src/modules/voice.js");
    const { User, Conversation, Record, Draft, Movement } =
      await import("../src/modules/models.js");
    const user = await User.findOne({ email: "owner@example.com" }).lean();
    const auth = {
      businessId: String(user!.businessId),
      userId: String(user!._id),
    };
    const counts = () =>
      Promise.all([
        Record.countDocuments(),
        Draft.countDocuments(),
        Movement.countDocuments(),
      ]);
    const before = await counts();
    const start = await understand(
      auth,
      "Start a purchase from ABC Mill for Sago",
    );
    expect(start.followUp?.field).toBe("quantity");
    const quantity = await understand(auth, "pathu mootai");
    expect(quantity.input).toMatchObject({
      kind: "purchase",
      contactId: supplier,
      productId: product,
      quantity: 10,
    });
    expect(quantity.followUp?.field).toBe("unitPrice");
    expect(quantity.followUp?.id).not.toBe(start.followUp?.id);
    const complete = await understand(auth, "3200 per bag");
    expect(complete.input).toMatchObject({
      kind: "purchase",
      contactId: supplier,
      productId: product,
      quantity: 10,
      unitPrice: "3200",
    });
    expect(complete.canPreview).toBe(true);
    expect(complete.followUp).toBeUndefined();
    expect(complete.summary).toMatchObject({
      contactName: "ABC Mill",
      productName: "Sago",
    });
    const saleQuestion = await understand(
      auth,
      "New sale to Ramesh, ten bags Sago at 3500",
    );
    expect(saleQuestion.followUp?.field).toBe("sourceId");
    expect(saleQuestion.followUp?.choices).toHaveLength(1);
    expect(saleQuestion.input.sourceId).toBeUndefined();
    const chosen = await understand(auth, "first option");
    expect(chosen.canPreview).toBe(true);
    expect(chosen.input).toMatchObject({
      kind: "sale",
      contactId: customer,
      productId: product,
      sourceId: purchase,
      quantity: 10,
      unitPrice: "3500",
    });
    expect(chosen.summary?.sourceLabel).toContain("ABC Mill");
    const recovered = await understand(
      auth,
      "Sale with unusable AI references",
    );
    expect(recovered.input).toMatchObject({
      kind: "sale",
      productId: product,
      quantity: 100,
      unitPrice: "1000",
    });
    expect(recovered.input.contactId).toBeUndefined();
    expect(recovered.input.sourceId).toBeUndefined();
    expect(recovered.canPreview).toBe(false);
    expect(recovered.followUp?.field).toBe("contactId");
    expect(
      recovered.followUp?.choices.some(
        (choice) => choice.label === "Ramesh Store",
      ),
    ).toBe(true);
    expect(await counts()).toEqual(before);
    await understand(auth, "cancel this draft");
    const cleared = await Conversation.findOne(auth).lean();
    expect(cleared?.pendingInput).toBeNull();
    expect(cleared?.pendingQuestion).toBeNull();
    expect(cleared?.pendingSourceIds).toEqual([]);
  });
  it("blocks cross-business references and foreign draft confirmation", async () => {
    expect(
      (
        await request(app)
          .post("/api/drafts")
          .set({ ...bearer(other), "Idempotency-Key": randomUUID() })
          .send({
            ...base,
            kind: "sale",
            contactId: customer,
            productId: product,
            sourceId: purchase,
            quantity: 20,
            unitPrice: "3500",
          })
      ).status,
    ).toBe(404);
    const draft = await postDraft({ ...base, kind: "expense", amount: "1" });
    expect((await commit(draft, other)).status).toBe(404);
  });
  it("allocates exact landed cost to the sale and reduces warehouse stock", async () => {
    const draft = await postDraft({
      ...base,
      kind: "sale",
      contactId: customer,
      productId: product,
      sourceId: purchase,
      quantity: 20,
      unitPrice: "3500",
      dueDate: "2026-11-15",
    });
    const r = await commit(draft);
    expect(r.status, r.text).toBe(200);
    sale = r.body._id;
    expect(r.body.cost).toBe(6500000);
    expect(r.body.total).toBe(7000000);
    expect(
      (await request(app).get("/api/inventory").set(bearer())).body.items[0]
        .availableQuantity,
    ).toBe(30);
  });
  it("answers the Tamil stock query with database quantities despite empty alias padding and makes no business writes", async () => {
    const { Record, Draft, Movement, Contact, Product } =
      await import("../src/modules/models.js");
    const counts = () =>
      Promise.all([
        Record.countDocuments(),
        Draft.countDocuments(),
        Movement.countDocuments(),
        Contact.countDocuments(),
        Product.countDocuments(),
      ]);
    const before = await counts();
    const expected = await request(app).get("/api/inventory").set(bearer());
    expect(expected.status, expected.text).toBe(200);
    const result = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "ஸ்டாக் எவ்வளவு இருக்கு?" });
    expect(result.status, result.text).toBe(200);
    expect(result.body.intent).toBe("GET_STOCK");
    expect(result.body.input).toEqual({});
    expect(result.body.clarification).toEqual([]);
    expect(result.body.canPreview).toBe(false);
    expect(result.body.answer.type).toBe("stock_summary");
    expect(
      result.body.answer.products.find(
        (item: { productId: string }) => item.productId === product,
      ).warehouseQuantity,
    ).toBe(30);
    const warehouse = expected.body.items.reduce(
      (sum: number, lot: { warehouseQuantity: number }) =>
        sum + lot.warehouseQuantity,
      0,
    );
    expect(
      result.body.answer.products.reduce(
        (sum: number, item: { warehouseQuantity: number }) =>
          sum + item.warehouseQuantity,
        0,
      ),
    ).toBe(warehouse);
    expect(result.body.answer.products).toHaveLength(1);
    expect(result.body.answer.products[0].unit).toBe("bag");
    const foreign = await request(app)
      .post("/api/voice/text")
      .set(bearer(other))
      .send({ text: "ஸ்டாக் எவ்வளவு இருக்கு?" });
    expect(foreign.status, foreign.text).toBe(200);
    expect(foreign.body.answer.products).toEqual([]);
    expect(await counts()).toEqual(before);
  });
  it("prevents overselling and overpayment", async () => {
    expect(
      (
        await request(app)
          .post("/api/drafts")
          .set({ ...bearer(), "Idempotency-Key": randomUUID() })
          .send({
            ...base,
            kind: "sale",
            contactId: customer,
            productId: product,
            sourceId: purchase,
            quantity: 31,
            unitPrice: "3500",
          })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post("/api/drafts")
          .set({ ...bearer(), "Idempotency-Key": randomUUID() })
          .send({
            ...base,
            kind: "customer_payment",
            contactId: customer,
            sourceId: sale,
            amount: "70001",
          })
      ).status,
    ).toBe(422);
  });
  it("issues an immutable invoice once with a real PDF and revocable link", async () => {
    const draft = await request(app)
      .post("/api/invoices")
      .set(bearer())
      .send({ saleId: sale });
    invoice = draft.body._id;
    const issued = await request(app)
      .post(`/api/invoices/${invoice}/issue`)
      .set(bearer())
      .send({ confirm: true });
    expect(issued.status, issued.text).toBe(200);
    expect(issued.body.number).toMatch(/^SG-\d{4}-00001$/);
    const again = await request(app)
      .post(`/api/invoices/${invoice}/issue`)
      .set(bearer())
      .send({ confirm: true });
    expect(again.body.number).toBe(issued.body.number);
    const pdf = await request(app)
      .get(`/api/invoices/${invoice}/pdf`)
      .set(bearer());
    expect(pdf.status, pdf.text).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
    await writeFile("/tmp/tamiltrade-test-invoice.pdf", pdf.body);
    const link = await request(app)
      .post(`/api/invoices/${invoice}/share`)
      .set(bearer())
      .send({});
    const token = link.body.url.split("/").at(-1);
    expect((await request(app).get("/share/" + token)).status).toBe(200);
    await request(app).delete(`/api/invoices/${invoice}/share`).set(bearer());
    expect((await request(app).get("/share/" + token)).status).toBe(404);
  });
  it("records a partial payment once and derives the remaining balance", async () => {
    const draft = await postDraft({
      ...base,
      kind: "customer_payment",
      contactId: customer,
      sourceId: sale,
      amount: "20000",
      method: "upi",
    });
    const r = await commit(draft);
    expect(r.status, r.text).toBe(200);
    expect((await commit(draft)).body._id).toBe(r.body._id);
    const contact = await request(app)
      .get("/api/contacts/" + customer)
      .set(bearer());
    expect(contact.body.balance).toBe(5000000);
    const dash = await request(app).get("/api/dashboard").set(bearer());
    expect(dash.body.receivables).toBe(5000000);
    expect(dash.body.payables).toBe(16250000);
    const answer = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "ரமேஷ் பாக்கி எவ்வளவு?" });
    expect(answer.status, answer.text).toBe(200);
    expect(answer.body.answer.balance).toBe(5000000);
  });
  it("answers transaction-detail questions from scoped saved records without financial writes", async () => {
    const { Record, Draft, Movement } =
      await import("../src/modules/models.js");
    const counts = () =>
      Promise.all([
        Record.countDocuments(),
        Draft.countDocuments(),
        Movement.countDocuments(),
      ]);
    const before = await counts();
    const englishLookup = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "Show me all the transaction of Ramesh Store." });
    expect(englishLookup.status, englishLookup.text).toBe(200);
    expect(englishLookup.body.intent).toBe("GET_TRANSACTION_DETAILS");
    expect(englishLookup.body.input).toEqual({ contactId: customer });
    expect(englishLookup.body.query).toEqual({});
    expect(
      englishLookup.body.answer.records
        .map((record: { kind: string }) => record.kind)
        .sort(),
    ).toEqual(["customer_payment", "sale"]);
    expect(englishLookup.body.canPreview).toBe(false);
    expect(await counts()).toEqual(before);
    const question =
      "ரமேஷ் எவ்வளோ மூட்டை கொடுத்தேன் அதோட விலை என்ன details கொடு";
    const answer = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: question });
    expect(answer.status, answer.text).toBe(200);
    expect(answer.body.intent).toBe("GET_TRANSACTION_DETAILS");
    expect(answer.body.input.kind).toBeUndefined();
    expect(answer.body.answer.records).toHaveLength(1);
    expect(answer.body.answer.records[0]).toMatchObject({
      _id: sale,
      quantity: 20,
      unitPrice: "3500",
      total: 7000000,
      paid: 2000000,
    });
    const uncertain = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "Rameshukku evlo mootai kuduthen details kaattu" });
    expect(uncertain.status).toBe(200);
    expect(uncertain.body.candidates).toContainEqual({
      _id: customer,
      name: "Ramesh Store",
    });
    expect(uncertain.body.answer).toBeUndefined();
    const chosen = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({
        text: "Rameshukku evlo mootai kuduthen details kaattu",
        contactId: customer,
      });
    expect(chosen.status, chosen.text).toBe(200);
    expect(chosen.body.answer.records[0]._id).toBe(sale);
    const wrongType = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "ABC Mill ku evlo mootai kuduthen details kaattu" });
    expect(wrongType.body.answer.records).toEqual([]);
    expect(wrongType.body.answer.text).toContain("No matching saved sales");
    const all = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "transaction details", contactId: supplier });
    expect(all.body.answer.records[0]._id).toBe(purchase);
    const foreign = await request(app)
      .post("/api/voice/text")
      .set(bearer(other))
      .send({ text: "transaction details", contactId: customer });
    expect(foreign.status).toBe(404);
    const dated = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "Ramesh Store 2001-01-01 transaction details" });
    expect(dated.body.answer.records).toEqual([]);
    expect(await counts()).toEqual(before);
  });
  it("does not allow editing a confirmed preview into a duplicate operation", async () => {
    const draft = await postDraft({
      ...base,
      kind: "expense",
      amount: "1",
      category: "Confirmation recovery test",
    });
    const posted = await commit(draft);
    expect(
      (await request(app).delete(`/api/drafts/${draft}`).set(bearer())).status,
    ).toBe(409);
    const existing = await request(app)
      .get(`/api/drafts/${draft}`)
      .set(bearer());
    expect(existing.body.recordId).toBe(posted.body._id);
    expect((await commit(draft)).body._id).toBe(posted.body._id);
  });
  it("rejects conflicting idempotency keys and cancelled previews", async () => {
    const key = randomUUID();
    const body = { ...base, kind: "expense", amount: "2" };
    const first = await request(app)
      .post("/api/drafts")
      .set({ ...bearer(), "Idempotency-Key": key })
      .send(body);
    expect(first.status, first.text).toBe(201);
    expect(
      (
        await request(app)
          .post("/api/drafts")
          .set({ ...bearer(), "Idempotency-Key": key })
          .send({ ...body, amount: "3" })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .delete("/api/drafts/" + first.body._id)
          .set(bearer())
      ).status,
    ).toBe(204);
    expect((await commit(first.body._id)).status).toBe(409);
  });
  it("serializes separate payment drafts to prevent concurrent overpayment", async () => {
    const input = {
      ...base,
      kind: "customer_payment",
      contactId: customer,
      sourceId: sale,
      amount: "40000",
    };
    const a = await postDraft(input),
      b = await postDraft(input);
    const results = await Promise.all([commit(a), commit(b)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
    const winner = results.find((r) => r.status === 200)!;
    expect(
      (
        await request(app)
          .post(`/api/records/${winner.body._id}/reverse`)
          .set(bearer())
          .send({ reason: "Concurrent payment safety test" })
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .get("/api/contacts/" + customer)
          .set(bearer())
      ).body.balance,
    ).toBe(5000000);
  });
  it("records direct deliveries without increasing warehouse stock", async () => {
    const p = await commit(
      await postDraft({
        ...base,
        kind: "purchase",
        contactId: supplier,
        productId: product,
        quantity: 10,
        unitPrice: "3000",
        delivery: "direct",
      }),
    );
    expect(p.status, p.text).toBe(200);
    const s = await commit(
      await postDraft({
        ...base,
        kind: "sale",
        contactId: customer,
        productId: product,
        sourceId: p.body._id,
        quantity: 10,
        unitPrice: "3500",
        delivery: "direct",
      }),
    );
    expect(s.status, s.text).toBe(200);
    const lots = (await request(app).get("/api/inventory").set(bearer())).body
      .items;
    expect(
      lots.reduce(
        (sum: number, l: { warehouseQuantity: number }) =>
          sum + l.warehouseQuantity,
        0,
      ),
    ).toBe(30);
  });
  it("preserves an audit trail for reversals and blocks dependent reversals", async () => {
    expect(
      (
        await request(app)
          .post(`/api/records/${purchase}/reverse`)
          .set(bearer())
          .send({ reason: "Incorrect purchase entry" })
      ).status,
    ).toBe(409);
    const e = await commit(
      await postDraft({
        ...base,
        kind: "expense",
        amount: "2500",
        category: "Rent",
      }),
    );
    expect(e.status, e.text).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/records/${e.body._id}/reverse`)
          .set(bearer())
          .send({ reason: "Duplicate rent expense" })
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .get("/api/records/" + e.body._id)
          .set(bearer())
      ).body.status,
    ).toBe("reversed");
  });
  it("excludes output tax from revenue and trading profit", async () => {
    const before = (await request(app).get("/api/dashboard").set(bearer()))
      .body;
    const p = await commit(
      await postDraft({
        ...base,
        date: indiaDate(),
        kind: "purchase",
        contactId: supplier,
        productId: product,
        quantity: 2,
        unitPrice: "100",
        taxBps: 500,
      }),
    );
    expect(p.status, p.text).toBe(200);
    const s = await commit(
      await postDraft({
        ...base,
        date: indiaDate(),
        kind: "sale",
        contactId: customer,
        productId: product,
        sourceId: p.body._id,
        quantity: 1,
        unitPrice: "150",
        taxBps: 500,
      }),
    );
    expect(s.status, s.text).toBe(200);
    expect(s.body.total).toBe(15750);
    expect(s.body.tax).toBe(750);
    expect(s.body.cost).toBe(10500);
    const after = (await request(app).get("/api/dashboard").set(bearer())).body;
    expect(after.grossProfit - before.grossProfit).toBe(4500);
    expect(after.monthlyRevenue - before.monthlyRevenue).toBe(15000);
    const answer = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "இந்த வியாபாரத்துல லாபம் எவ்வளவு?" });
    expect(answer.status, answer.text).toBe(200);
    expect(answer.body.answer.grossProfit).toBe(4500);
    expect(answer.body.answer.saleId).toBe(s.body._id);
    const todaySales = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "How much sales has happened today?" });
    expect(todaySales.status, todaySales.text).toBe(200);
    expect(todaySales.body.intent).toBe("GET_DAILY_SALES");
    expect(todaySales.body.input).toEqual({});
    expect(todaySales.body.clarification).toEqual([]);
    expect(todaySales.body.answer.salesTotal).toBe(before.todaySales + 15750);
    expect(todaySales.body.answer.salesCount).toBe(1);
    expect(todaySales.body.answer.date).toBe(indiaDate());
    expect(todaySales.body.canPreview).toBe(false);
    const { salesSummary } = await import("../src/modules/reporting.js");
    const { User } = await import("../src/modules/models.js");
    const businessOwner = await User.findOne({ email: "owner@example.com" });
    const earlier = await salesSummary(String(businessOwner!.businessId), {
      date: base.date,
    });
    expect(earlier.salesTotal).toBe(10500000);
    expect(earlier.salesCount).toBe(2);
    const empty = await salesSummary(String(businessOwner!.businessId), {
      date: "2001-01-01",
    });
    expect(empty.salesTotal).toBe(0);
    expect(empty.salesCount).toBe(0);
    const ranged = await salesSummary(String(businessOwner!.businessId), {
      from: base.date,
      to: indiaDate(),
    });
    expect(ranged.salesTotal).toBe(10515750);
    expect(ranged.salesCount).toBe(3);
    const otherOwner = await User.findOne({ email: "other@example.com" });
    const isolated = await salesSummary(String(otherOwner!.businessId), {
      from: base.date,
      to: indiaDate(),
    });
    expect(isolated.salesTotal).toBe(0);
    expect(isolated.salesCount).toBe(0);
  });
  it("enforces staff permissions on the server", async () => {
    const staff = await request(app)
      .post("/auth/staff")
      .set(bearer())
      .send({
        name: "Staff",
        email: "staff@example.com",
        password: "Testing-password-123",
        permissions: ["sales"],
      });
    expect(staff.status, staff.text).toBe(201);
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "staff@example.com", password: "Testing-password-123" });
    expect(login.status, login.text).toBe(200);
    expect(
      (
        await request(app)
          .post("/api/voice/text")
          .set(bearer(login.body.accessToken))
          .send({ text: "ரமேஷ் பாக்கி எவ்வளவு?" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/contacts")
          .set(bearer(login.body.accessToken))
          .send({ name: "Illegal", kind: "customer" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get("/api/dashboard")
          .set(bearer(login.body.accessToken))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/drafts")
          .set({
            ...bearer(login.body.accessToken),
            "Idempotency-Key": randomUUID(),
          })
          .send({ ...base, kind: "expense", amount: "1" })
      ).status,
    ).toBe(403);
  });
  it("rejects malicious uploads and unauthenticated API requests", async () => {
    expect((await request(app).get("/api/dashboard")).status).toBe(401);
    const { publishVoiceWorkerHeartbeat } =
      await import("../src/shared/voice-worker-lease.js");
    await publishVoiceWorkerHeartbeat(randomUUID());
    const upload = await request(app)
      .post("/api/voice/jobs")
      .set({ ...bearer(), "Idempotency-Key": randomUUID() })
      .attach("audio", Buffer.from("not audio at all"), {
        filename: "attack.m4a",
        contentType: "audio/mp4",
      });
    expect(upload.status, upload.text).toBe(415);
  });
  it("reviews a voice-created supplier, rejects stale/foreign reviews, and saves exactly once", async () => {
    const { Contact, Record, Movement } =
      await import("../src/modules/models.js");
    const records = await Record.countDocuments(),
      movements = await Movement.countDocuments();
    const propose = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "Add Voice Demo Mill as supplier phone 09876543210" });
    expect(propose.status, propose.text).toBe(200);
    expect(propose.body.catalogAction.kind).toBe("supplier");
    expect(propose.body.canPreview).toBe(true);
    expect(await Contact.countDocuments({ name: "Voice Demo Mill" })).toBe(0);
    const oldReview = propose.body.catalogAction.reviewId;
    const changed = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "Correct phone to +919876543210" });
    expect(changed.status, changed.text).toBe(200);
    expect(changed.body.catalogAction.input.name).toBe("Voice Demo Mill");
    expect(changed.body.catalogAction.reviewId).not.toBe(oldReview);
    const confirm = (reviewId: string, token = owner) =>
      request(app)
        .post("/api/voice/catalog/confirm")
        .set(bearer(token))
        .send({ confirm: true, reviewId });
    expect((await confirm(oldReview)).status).toBe(409);
    expect(
      (await confirm(changed.body.catalogAction.reviewId, other)).status,
    ).toBe(409);
    const reviewId = changed.body.catalogAction.reviewId;
    const [first, repeat] = await Promise.all([
      confirm(reviewId),
      confirm(reviewId),
    ]);
    expect(first.status, first.text).toBe(201);
    expect(repeat.status, repeat.text).toBe(201);
    expect(first.body.entityId).toBe(repeat.body.entityId);
    const rows = await Contact.find({ name: "Voice Demo Mill" }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      phone: "+919876543210",
      kind: "supplier",
      paymentTermsDays: 15,
    });
    expect(await Record.countDocuments()).toBe(records);
    expect(await Movement.countDocuments()).toBe(movements);
  });
  it("starts contact entry without an AI call, merges a voice reply, and uses the manual schema/defaults", async () => {
    const fetchCalls = vi.mocked(fetch).mock.calls.length;
    const start = await request(app)
      .post("/api/voice/catalog/start")
      .set(bearer())
      .send({ kind: "customer" });
    expect(start.status, start.text).toBe(200);
    expect(vi.mocked(fetch).mock.calls.length).toBe(fetchCalls);
    expect(start.body.followUp.field).toBe("name");
    expect(
      (
        await request(app)
          .post("/api/voice/catalog/confirm")
          .set(bearer())
          .send({ confirm: true, reviewId: start.body.catalogAction.reviewId })
      ).status,
    ).toBe(422);
    const reply = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "Voice Demo Customer, 09876543211, credit limit 2500" });
    expect(reply.status, reply.text).toBe(200);
    expect(reply.body.catalogAction.input.phone).toBe("09876543211");
    expect(reply.body.canPreview).toBe(true);
    const saved = await request(app)
      .post("/api/voice/catalog/confirm")
      .set(bearer())
      .send({ confirm: true, reviewId: reply.body.catalogAction.reviewId });
    expect(saved.status, saved.text).toBe(201);
    const detail = await request(app)
      .get(`/api/contacts/${saved.body.entityId}`)
      .set(bearer());
    expect(detail.body).toMatchObject({
      name: "Voice Demo Customer",
      phone: "09876543211",
      address: "Salem",
      kind: "customer",
      aliases: ["மாதிரி கடை"],
      creditLimit: 250000,
      paymentTermsDays: 30,
      balance: 0,
    });
    expect(
      (
        await request(app)
          .get(`/api/contacts/${saved.body.entityId}`)
          .set(bearer(other))
      ).status,
    ).toBe(404);
  });
  it("collects product unit/weight by voice and creates a product without inventing stock", async () => {
    const { Product, Record, Movement } =
      await import("../src/modules/models.js");
    const before = {
      records: await Record.countDocuments(),
      movements: await Movement.countDocuments(),
    };
    const command = (text: string) =>
      request(app).post("/api/voice/text").set(bearer()).send({ text });
    const first = await command("Add Rice Demo product");
    expect(first.status, first.text).toBe(200);
    expect(first.body.followUp.field).toBe("unit");
    const unit = await command("Trading unit bag");
    expect(unit.status, unit.text).toBe(200);
    expect(unit.body.followUp.field).toBe("weightGrams");
    expect(await Product.countDocuments({ name: "Rice Demo" })).toBe(0);
    const weight = await command("25 kilograms per bag, low stock 5");
    expect(weight.status, weight.text).toBe(200);
    expect(weight.body.canPreview).toBe(true);
    expect(weight.body.catalogAction.input).toMatchObject({
      unit: "bag",
      weightGrams: 25000,
      lowStockQuantity: 5,
    });
    const saved = await request(app)
      .post("/api/voice/catalog/confirm")
      .set(bearer())
      .send({ confirm: true, reviewId: weight.body.catalogAction.reviewId });
    expect(saved.status, saved.text).toBe(201);
    expect(await Product.findById(saved.body.entityId).lean()).toMatchObject({
      name: "Rice Demo",
      unit: "bag",
      weightGrams: 25000,
      lowStockQuantity: 5,
    });
    expect(await Record.countDocuments()).toBe(before.records);
    expect(await Movement.countDocuments()).toBe(before.movements);
    const duplicate = await command("Add Rice Demo product");
    expect(duplicate.body.canPreview).toBe(false);
    expect(duplicate.body.followUp).toBeDefined();
    expect(duplicate.body.clarification.join(" ")).toContain("already exists");
  });
  it("requires contacts permission for every voice catalog entry point", async () => {
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "staff@example.com", password: "Testing-password-123" });
    expect(login.status, login.text).toBe(200);
    const token = login.body.accessToken;
    for (const path of [
      "/api/voice/catalog/start",
      "/api/voice/catalog/confirm",
    ]) {
      const response = await request(app)
        .post(path)
        .set(bearer(token))
        .send({ kind: "supplier", confirm: true, reviewId: randomUUID() });
      expect(response.status, response.text).toBe(403);
    }
    const response = await request(app)
      .post("/api/voice/text")
      .set(bearer(token))
      .send({ text: "Add Voice Demo Mill as supplier phone 09876543210" });
    expect(response.status, response.text).toBe(403);
  });
  it("does not save a cancelled or expired voice catalog draft", async () => {
    const { Conversation } = await import("../src/modules/models.js");
    const start = await request(app)
      .post("/api/voice/catalog/start")
      .set(bearer())
      .send({ kind: "supplier" });
    const cancel = await request(app)
      .post("/api/voice/text")
      .set(bearer())
      .send({ text: "Cancel the catalog entry" });
    expect(cancel.status, cancel.text).toBe(200);
    expect(
      (
        await request(app)
          .post("/api/voice/catalog/confirm")
          .set(bearer())
          .send({ confirm: true, reviewId: start.body.catalogAction.reviewId })
      ).status,
    ).toBe(409);
    const again = await request(app)
      .post("/api/voice/catalog/start")
      .set(bearer())
      .send({ kind: "supplier" });
    await Conversation.updateOne(
      { "pendingCatalogAction.reviewId": again.body.catalogAction.reviewId },
      { expiresAt: new Date(0) },
    );
    expect(
      (
        await request(app)
          .post("/api/voice/catalog/confirm")
          .set(bearer())
          .send({ confirm: true, reviewId: again.body.catalogAction.reviewId })
      ).status,
    ).toBe(409);
  });
  it("summarizes all stock lots by product with saved units and separate direct deliveries", async () => {
    const { Product, Record } = await import("../src/modules/models.js");
    const { stockSummary } = await import("../src/modules/reporting.js");
    const businessId = new mongoose.Types.ObjectId(),
      foreignId = new mongoose.Types.ObjectId();
    const productInput = { businessId, category: "", lowStockQuantity: 10 };
    const [bags, kilograms, empty, directOnly, foreign] = await Product.create([
      {
        ...productInput,
        name: "Demo Bag Rice",
        unit: "bag",
        weightGrams: 50000,
      },
      {
        ...productInput,
        name: "Demo Kilogram Rice",
        unit: "kg",
        weightGrams: 1000,
      },
      { ...productInput, name: "Demo Empty", unit: "bag", weightGrams: 25000 },
      {
        ...productInput,
        name: "Demo Direct Only",
        unit: "carton",
        weightGrams: 10000,
      },
      {
        ...productInput,
        businessId: foreignId,
        name: "Foreign product",
        unit: "box",
        weightGrams: 5000,
      },
    ]);
    const lot = (
      productId: mongoose.Types.ObjectId,
      quantity: number,
      allocatedQuantity = 0,
      delivery = "warehouse",
    ) => ({
      businessId,
      productId,
      productName: "Old product label",
      kind: "purchase",
      status: "posted",
      input: { kind: "purchase" },
      date: "2026-10-21",
      delivery,
      quantity,
      allocatedQuantity,
    });
    try {
      await Record.insertMany([
        ...Array.from({ length: 51 }, () => lot(bags!._id, 1)),
        lot(bags!._id, 289),
        lot(bags!._id, 12, 2, "direct"),
        lot(bags!._id, 100, 100),
        { ...lot(bags!._id, 1000), status: "reversed" },
        { ...lot(bags!._id, 1000), kind: "sale" },
        lot(kilograms!._id, 7),
        lot(kilograms!._id, 3, 1),
        lot(empty!._id, 100, 100),
        lot(directOnly!._id, 8, 0, "direct"),
        { ...lot(foreign!._id, 10000), businessId: foreignId },
      ]);
      const before = await Record.countDocuments();
      const summary = await stockSummary(String(businessId));
      expect(summary.type).toBe("stock_summary");
      expect(summary.products).toHaveLength(3);
      expect(
        summary.products.find((item) => item.productId === String(bags!._id)),
      ).toEqual({
        productId: String(bags!._id),
        productName: "Demo Bag Rice",
        unit: "bag",
        weightGrams: 50000,
        warehouseQuantity: 340,
        directQuantity: 10,
      });
      expect(
        summary.products.find(
          (item) => item.productId === String(kilograms!._id),
        ),
      ).toMatchObject({ unit: "kg", warehouseQuantity: 9, directQuantity: 0 });
      expect(
        summary.products.find(
          (item) => item.productId === String(directOnly!._id),
        ),
      ).toMatchObject({
        unit: "carton",
        warehouseQuantity: 0,
        directQuantity: 8,
      });
      expect(
        summary.products.some((item) => item.productId === String(empty!._id)),
      ).toBe(false);
      const filtered = await stockSummary(
        String(businessId),
        String(bags!._id),
      );
      expect(filtered.products).toHaveLength(1);
      expect(filtered.products[0]).toMatchObject({ warehouseQuantity: 340 });
      expect(
        (await stockSummary(String(businessId), String(foreign!._id))).products,
      ).toEqual([]);
      expect(
        (await stockSummary(String(businessId), String(empty!._id))).products,
      ).toEqual([]);
      expect(
        (await stockSummary(String(new mongoose.Types.ObjectId()))).products,
      ).toEqual([]);
      expect(await Record.countDocuments()).toBe(before);
    } finally {
      await Record.deleteMany({ businessId: { $in: [businessId, foreignId] } });
      await Product.deleteMany({
        businessId: { $in: [businessId, foreignId] },
      });
    }
  });
  it("rotates refresh tokens and revokes the session on replay", async () => {
    const r = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: refresh });
    expect(r.status, r.text).toBe(200);
    expect(
      (await request(app).post("/auth/refresh").send({ refreshToken: refresh }))
        .status,
    ).toBe(401);
    expect(
      (await request(app).get("/auth/me").set(bearer(r.body.accessToken)))
        .status,
    ).toBe(401);
  });
});
