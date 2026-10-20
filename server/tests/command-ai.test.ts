import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { indiaDate } from "@tamiltrade/shared";
import {
  extractCommand,
  interpretCommand,
  validateCommandPlan,
  commandPlanSchema,
  type CommandPlan,
  type CommandCatalog,
} from "../src/modules/command-ai.js";
const customer = { _id: "a".repeat(24), name: "Kishore", aliases: ["கிஷோர்"] };
const supplier = { _id: "b".repeat(24), name: "ABC Mill" };
const product = { _id: "c".repeat(24), name: "Sago", unit: "bag" };
const purchaseId = "d".repeat(24),
  saleId = "e".repeat(24);
const catalog: CommandCatalog = {
  customers: [customer],
  suppliers: [supplier],
  products: [product],
  context: { purchaseId, saleId, contactId: customer._id },
};
const options = {
  apiKey: "private-test-key",
  model: "qwen/qwen3.8-27b",
  timeoutMs: 25000,
};
let keySequence = 0;
beforeEach(() => {
  options.apiKey = `private-test-key-${++keySequence}`;
});
const plan = (overrides: Partial<CommandPlan> = {}): CommandPlan => ({
  intent: "GET_TRANSACTION_DETAILS",
  input: { contactId: customer._id },
  query: { kind: "sale" },
  candidateContactIds: [],
  clarification: [],
  ...overrides,
});
const envelope = (data: unknown, finishReason = "stop") =>
  Response.json({
    choices: [
      {
        finish_reason: finishReason,
        message: {
          role: "assistant",
          content: typeof data === "string" ? data : JSON.stringify(data),
        },
      },
    ],
  });
const geminiEnvelope = (data: unknown, finishReason = "STOP") =>
  Response.json({
    candidates: [
      {
        finishReason,
        content: {
          role: "model",
          parts: [
            { text: typeof data === "string" ? data : JSON.stringify(data) },
          ],
        },
      },
    ],
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("quota fallback from Groq to Gemini", () => {
  const fallbackOptions = () => ({
    ...options,
    gemini: {
      apiKey: `gemini-${options.apiKey}`,
      model: "gemini-3.5-flash-lite",
    },
  });
  it("uses Groq alone when it succeeds and reports the actual provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope(plan()));
    vi.stubGlobal("fetch", fetchMock);
    const result = await interpretCommand(
      "Kishore transactions",
      catalog,
      fallbackOptions(),
    );
    expect(result.understanding).toEqual({
      provider: "groq",
      model: options.model,
      fallback: false,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("switches once on quota rejection and sends the same command, pending replies and schema", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(geminiEnvelope(plan()));
    vi.stubGlobal("fetch", fetchMock);
    const context = {
      ...catalog,
      context: {
        pendingInput: { kind: "sale" as const, quantity: 150 },
        pendingQuestion: { field: "unitPrice", question: "Price per bag?" },
      },
    };
    const config = fallbackOptions();
    const result = await interpretCommand(
      "ஒரு மூட்டை 150 rupees",
      context,
      config,
    );
    expect(result.understanding).toEqual({
      provider: "gemini",
      model: config.gemini.model,
      fallback: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, request] = fetchMock.mock.calls[1]!;
    expect(url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent`,
    );
    expect(url).not.toContain(config.gemini.apiKey);
    expect(request.headers["x-goog-api-key"]).toBe(config.gemini.apiKey);
    expect(request.headers.Authorization).toBeUndefined();
    expect(request.redirect).toBe("error");
    const primary = JSON.parse(fetchMock.mock.calls[0]![1].body);
    const backup = JSON.parse(request.body);
    expect(backup.contents[0].parts[0].text).toBe(primary.messages[1].content);
    expect(backup.systemInstruction.parts[0].text).toBe(
      primary.messages[0].content,
    );
    expect(backup.generationConfig.responseJsonSchema).toEqual(
      primary.response_format.json_schema.schema,
    );
    expect(backup.tools).toBeUndefined();
    expect(request.signal).toBe(fetchMock.mock.calls[0]![1].signal);
  });
  it("skips the exhausted primary during cooldown and returns to it after reset", async () => {
    let now = 1000000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { "retry-after": "10" } }),
      )
      .mockResolvedValueOnce(geminiEnvelope(plan()))
      .mockResolvedValueOnce(geminiEnvelope(plan()))
      .mockResolvedValueOnce(envelope(plan()));
    vi.stubGlobal("fetch", fetchMock);
    const config = fallbackOptions();
    expect(
      (await interpretCommand("command", catalog, config)).understanding
        .provider,
    ).toBe("gemini");
    now += 2000;
    await interpretCommand("another command", catalog, config);
    expect(fetchMock.mock.calls[2]![0]).toContain(
      "generativelanguage.googleapis.com",
    );
    now += 8000;
    expect(
      (await interpretCommand("command", catalog, config)).understanding
        .provider,
    ).toBe("groq");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("waits for the earliest provider reset when both quotas are exhausted and avoids retry loops", async () => {
    let now = 1000000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { "retry-after": "100" } }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              details: [
                {
                  "@type": "type.googleapis.com/google.rpc.RetryInfo",
                  retryDelay: "20.2s",
                },
              ],
            },
          },
          { status: 429 },
        ),
      )
      .mockResolvedValueOnce(geminiEnvelope(plan()));
    vi.stubGlobal("fetch", fetchMock);
    const config = fallbackOptions();
    await expect(
      extractCommand("command", catalog, config),
    ).rejects.toMatchObject({ code: "AI_RATE_LIMIT", retryAfterSeconds: 21 });
    now += 1000;
    await expect(
      extractCommand("different command", catalog, config),
    ).rejects.toMatchObject({ code: "AI_RATE_LIMIT", retryAfterSeconds: 20 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    now += 20000;
    await expect(
      extractCommand("command", catalog, config),
    ).resolves.toMatchObject({ intent: "GET_TRANSACTION_DETAILS" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it.each([401, 500])("does not switch for primary HTTP %s", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      extractCommand("command", catalog, fallbackOptions()),
    ).rejects.toBeInstanceOf(Error);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("does not switch after primary malformed output or invent a replacement plan", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope("not json"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      extractCommand("command", catalog, fallbackOptions()),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each(["MAX_TOKENS", "SAFETY"])(
    "rejects unfinished or blocked backup output: %s",
    async (reason) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 429 }))
        .mockResolvedValueOnce(geminiEnvelope(plan(), reason));
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        extractCommand("command", catalog, fallbackOptions()),
      ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );
  it("validates backup references against the current business catalog", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 429 }))
        .mockResolvedValueOnce(
          geminiEnvelope(plan({ input: { contactId: "f".repeat(24) } })),
        ),
    );
    await expect(
      interpretCommand("show records", catalog, fallbackOptions()),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });
  it("keeps a backup sale as a proposal requiring missing details and confirmation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 429 }))
        .mockResolvedValueOnce(
          geminiEnvelope(
            plan({
              intent: "CREATE_SALE",
              input: {
                contactName: "Kishore",
                quantity: 150,
                unitPrice: "150",
              },
              query: {},
            }),
          ),
        ),
    );
    const result = await interpretCommand(
      "Kishore ku 150 mootai sell pannen one bag 150",
      catalog,
      fallbackOptions(),
    );
    expect(result.input).toMatchObject({
      kind: "sale",
      contactId: customer._id,
      quantity: 150,
      unitPrice: "150",
    });
    expect(result.canPreview).toBe(false);
    expect(result.missing).toContain("productId");
    expect(result.understanding.provider).toBe("gemini");
  });
  it.each([401, 403, 500])(
    "does not expose credentials or raw backup errors for HTTP %s",
    async (status) => {
      const config = fallbackOptions();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 429 }))
        .mockResolvedValueOnce(
          new Response(`${config.gemini.apiKey} confidential`, { status }),
        );
      vi.stubGlobal("fetch", fetchMock);
      const error = await extractCommand("command", catalog, config).catch(
        (error) => error,
      );
      expect(error.code).toBe(
        status === 500 ? "AI_UNAVAILABLE" : "AI_CONFIGURATION",
      );
      expect(String(error)).not.toContain(config.gemini.apiKey);
      expect(String(error)).not.toContain("confidential");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );
});

describe("Groq command understanding", () => {
  it.each([
    { contactId: "f".repeat(24) },
    { contactId: supplier._id },
    { productId: "f".repeat(24) },
    { productName: "Rice", productId: product._id },
    { contactName: "Other customer", contactId: customer._id },
    { sourceId: "f".repeat(24) },
    { sourceOption: 2 },
    {
      contactId: "f".repeat(24),
      productId: "f".repeat(24),
      sourceId: "f".repeat(24),
    },
  ])(
    "asks for invalid write references while keeping quantities and prices: %j",
    async (badFields) => {
      const fetchMock = vi.fn().mockResolvedValue(
        envelope(
          plan({
            intent: "CREATE_SALE",
            input: {
              contactId: customer._id,
              productId: product._id,
              quantity: 100,
              unitPrice: "1000",
              ...badFields,
            },
            query: {},
          }),
        ),
      );
      vi.stubGlobal("fetch", fetchMock);
      const result = await interpretCommand(
        "100 bags Sago, 1000 per bag",
        catalog,
        options,
      );
      expect(result.input).toMatchObject({
        kind: "sale",
        quantity: 100,
        unitPrice: "1000",
      });
      expect(result.canPreview).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.clarification.length).toBeGreaterThan(0);
      expect(result.input.contactId).not.toBe(supplier._id);
      expect(result.input.sourceId).toBeUndefined();
      for (const field of ["contactId", "productId", "sourceId"] as const)
        expect(result.input[field]).not.toBe("f".repeat(24));
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );
  it("does not reuse an old product's rate after an unresolved spoken product correction", async () => {
    const pending = {
      kind: "sale" as const,
      date: indiaDate(),
      contactId: customer._id,
      productId: product._id,
      sourceId: purchaseId,
      quantity: 10,
      unitPrice: "3000",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        envelope(
          plan({
            intent: "UPDATE_PENDING_DRAFT",
            input: { productId: "f".repeat(24) },
            query: {},
          }),
        ),
      ),
    );
    const result = await interpretCommand(
      "change product",
      { ...catalog, context: { pendingInput: pending } },
      options,
    );
    expect(result.input.productId).toBeUndefined();
    expect(result.input.sourceId).toBeUndefined();
    expect(result.input.quantity).toBeUndefined();
    expect(result.input.unitPrice).toBeUndefined();
    expect(pending).toMatchObject({
      productId: product._id,
      sourceId: purchaseId,
      quantity: 10,
      unitPrice: "3000",
    });
    expect(result.canPreview).toBe(false);
  });
  it("does not repair unsafe report references into a different lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          envelope(plan({ input: { contactId: "f".repeat(24) } })),
        ),
    );
    await expect(
      interpretCommand("Show records", catalog, options),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE", reason: "contact" });
  });
  it("treats null optional containers as missing details instead of losing the whole command", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        envelope({
          intent: "CREATE_EXPENSE",
          input: null,
          query: null,
          candidateContactIds: null,
          clarification: null,
        }),
      ),
    );
    const result = await interpretCommand(
      "record an expense",
      catalog,
      options,
    );
    expect(result.input.kind).toBe("expense");
    expect(result.missing).toContain("amount");
    expect(result.canPreview).toBe(false);
  });
  it("merges short voice replies into the pending draft without losing earlier fields", () => {
    const pending = {
      kind: "purchase" as const,
      date: indiaDate(),
      contactId: supplier._id,
      productId: product._id,
      transport: "500",
    };
    const quantity = validateCommandPlan(
      plan({
        intent: "UPDATE_PENDING_DRAFT",
        input: { quantity: 10 },
        query: {},
      }),
      "pathu mootai",
      {
        ...catalog,
        context: {
          pendingInput: pending,
          pendingQuestion: { field: "quantity", question: "How many bags?" },
        },
      },
    );
    expect(quantity.input).toMatchObject({ ...pending, quantity: 10 });
    expect(quantity.missing).toEqual(["unitPrice"]);
    expect(quantity.canPreview).toBe(false);
    const price = validateCommandPlan(
      plan({
        intent: "UPDATE_PENDING_DRAFT",
        input: { unitPrice: "3200" },
        query: {},
      }),
      "3200",
      {
        ...catalog,
        context: {
          pendingInput: quantity.input,
          pendingQuestion: { field: "unitPrice", question: "Price per bag?" },
        },
      },
    );
    expect(price.input).toMatchObject({
      ...pending,
      quantity: 10,
      unitPrice: "3200",
    });
    expect(price.canPreview).toBe(true);
  });
  it("maps an explicitly selected source option and rejects unavailable options", () => {
    const pending = {
      kind: "sale" as const,
      date: indiaDate(),
      contactId: customer._id,
      productId: product._id,
      quantity: 10,
      unitPrice: "3200",
    };
    const sourceCatalog: CommandCatalog = {
      ...catalog,
      context: {
        pendingInput: pending,
        pendingQuestion: {
          field: "sourceId",
          question: "Which lot?",
          choices: [{ value: "1", label: "Lot one" }],
        },
      },
      sources: [
        {
          _id: purchaseId,
          option: 1,
          label: "Lot one",
          kind: "purchase",
          productId: product._id,
          delivery: "warehouse",
        },
      ],
    };
    const reply = (sourceOption: number) =>
      validateCommandPlan(
        plan({
          intent: "UPDATE_PENDING_DRAFT",
          input: { sourceOption },
          query: {},
        }),
        "first option",
        sourceCatalog,
      );
    expect(reply(1).input).toMatchObject({ ...pending, sourceId: purchaseId });
    expect(reply(1).canPreview).toBe(true);
    expect(() => reply(2)).toThrowError(
      expect.objectContaining({ code: "AI_INVALID_RESPONSE" }),
    );
    expect(() =>
      validateCommandPlan(
        plan({
          intent: "UPDATE_PENDING_DRAFT",
          input: { sourceOption: 1 },
          query: {},
        }),
        "first option",
        {
          ...sourceCatalog,
          context: {
            pendingInput: pending,
            pendingQuestion: {
              field: "sourceId",
              question: "No eligible lots",
              choices: [],
            },
          },
        },
      ),
    ).toThrowError(expect.objectContaining({ code: "AI_INVALID_RESPONSE" }));
    const unchanged = validateCommandPlan(
      plan({ intent: "UPDATE_PENDING_DRAFT", input: {}, query: {} }),
      "not sure",
      sourceCatalog,
    );
    expect(unchanged.input.sourceId).toBeUndefined();
    expect(unchanged.canPreview).toBe(false);
  });
  it("asks again when a correction changes the product instead of keeping its old allocation and price", () => {
    const otherProduct = { _id: "f".repeat(24), name: "Rice" };
    const result = validateCommandPlan(
      plan({
        intent: "UPDATE_PENDING_DRAFT",
        input: { productId: otherProduct._id },
        query: {},
      }),
      "change to rice",
      {
        ...catalog,
        products: [product, otherProduct],
        context: {
          pendingInput: {
            kind: "sale",
            date: indiaDate(),
            contactId: customer._id,
            productId: product._id,
            sourceId: purchaseId,
            quantity: 10,
            unitPrice: "3000",
          },
        },
      },
    );
    expect(result.input.productId).toBe(otherProduct._id);
    expect(result.input.sourceId).toBeUndefined();
    expect(result.input.quantity).toBeUndefined();
    expect(result.input.unitPrice).toBeUndefined();
    expect(result.canPreview).toBe(false);
  });
  it("rejects source choices on an expense and rechecks a payment's account", () => {
    const sources: CommandCatalog["sources"] = [
      {
        _id: purchaseId,
        option: 1,
        label: "Lot",
        kind: "purchase",
        contactId: supplier._id,
      },
    ];
    expect(() =>
      validateCommandPlan(
        plan({
          intent: "CREATE_EXPENSE",
          input: { sourceOption: 1, amount: "10" },
          query: {},
        }),
        "expense",
        { ...catalog, sources },
      ),
    ).toThrowError(expect.objectContaining({ code: "AI_INVALID_RESPONSE" }));
    const otherSupplier = { _id: "f".repeat(24), name: "Other Mill" };
    const result = validateCommandPlan(
      plan({
        intent: "UPDATE_PENDING_DRAFT",
        input: { sourceOption: 1 },
        query: {},
      }),
      "option one",
      {
        ...catalog,
        suppliers: [supplier, otherSupplier],
        sources,
        context: {
          pendingQuestion: {
            field: "sourceId",
            question: "Which transaction?",
            choices: [{ value: "1", label: "Lot" }],
          },
          pendingInput: {
            kind: "supplier_payment",
            date: indiaDate(),
            contactId: otherSupplier._id,
            amount: "10",
          },
        },
      },
    );
    expect(result.input.sourceId).toBeUndefined();
    expect(result.canPreview).toBe(false);
  });
  it.each([
    { input: {}, query: { date: indiaDate() } },
    { input: { date: indiaDate() }, query: {} },
    { input: { date: indiaDate() }, query: { date: indiaDate() } },
    { input: {}, query: { from: "2026-10-01", to: "2026-10-19" } },
  ])(
    "accepts a sales report date without creating a transaction: %j",
    ({ input, query }) => {
      const result = validateCommandPlan(
        plan({
          intent: "GET_DAILY_SALES",
          input,
          query,
        }),
        "How much sales has happened today?",
        catalog,
      );
      expect(result.input).toEqual({});
      expect(result.query).toEqual(
        Object.keys(query).length ? query : { date: indiaDate() },
      );
      expect(result.clarification).toEqual([]);
      expect(result.canPreview).toBe(false);
    },
  );
  it("rejects conflicting provider dates instead of showing the wrong day", () => {
    expect(() =>
      validateCommandPlan(
        plan({
          intent: "GET_DAILY_SALES",
          input: { date: "2026-10-18" },
          query: { date: "2026-10-19" },
        }),
        "today sales",
        catalog,
      ),
    ).toThrowError(expect.objectContaining({ code: "AI_INVALID_RESPONSE" }));
  });
  it("checks the pending transaction's account role when applying a correction", () => {
    expect(() =>
      validateCommandPlan(
        plan({
          intent: "UPDATE_PENDING_DRAFT",
          input: { contactId: supplier._id },
        }),
        "change the account",
        { ...catalog, context: { pendingInput: { kind: "sale" } } },
      ),
    ).toThrowError(expect.objectContaining({ code: "AI_INVALID_RESPONSE" }));
  });
  it("requires clarification for unsupported report periods instead of substituting current figures", () => {
    const result = validateCommandPlan(
      plan({
        intent: "GET_PROFIT",
        input: {},
        query: { from: "2020-01-01", to: "2020-01-31" },
      }),
      "profit for January 2020",
      catalog,
    );
    expect(result.clarification.length).toBeGreaterThan(0);
    expect(result.canPreview).toBe(false);
  });
  it("sends original Tamil/Tanglish with scoped catalog, context and a structured output schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope(plan()));
    vi.stubGlobal("fetch", fetchMock);
    const text = "கிஷோருக்கு எவ்வளோ மூட்டை கொடுத்தேன் details கொடு";
    const result = await interpretCommand(text, catalog, options);
    expect(result.intent).toBe("GET_TRANSACTION_DETAILS");
    expect(result.input.kind).toBeUndefined();
    expect(result.canPreview).toBe(false);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(request.headers.Authorization).toBe(`Bearer ${options.apiKey}`);
    expect(request.redirect).toBe("error");
    const body = JSON.parse(request.body);
    expect(JSON.parse(body.messages[1].content)).toMatchObject({
      command: text,
      customers: [customer],
      products: [product],
      context: catalog.context,
    });
    expect(body.messages[0].content).toContain("untrusted");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    const schema = body.response_format.json_schema.schema;
    expect(schema.properties.intent.enum).toContain("GET_TRANSACTION_DETAILS");
    for (const object of [
      schema,
      schema.properties.input,
      schema.properties.query,
    ]) {
      expect(object.additionalProperties).toBe(false);
      expect([...object.required].sort()).toEqual(
        Object.keys(object.properties).sort(),
      );
    }
    expect(JSON.stringify(body)).not.toContain(options.apiKey);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("validates a model-extracted sale and requires the missing source rather than guessing one", () => {
    const result = validateCommandPlan(
      plan({
        intent: "CREATE_SALE",
        input: {
          contactId: customer._id,
          productId: product._id,
          quantity: 10,
          unitPrice: "3000",
        },
        query: {},
      }),
      "Vishalukku pathu mootai kuduthen",
      catalog,
    );
    expect(result.input).toMatchObject({
      kind: "sale",
      quantity: 10,
      unitPrice: "3000",
    });
    expect(result.missing).toContain("sourceId");
    expect(result.canPreview).toBe(false);
  });
  it("validates a complete purchase while keeping it an editable preview", () => {
    const result = validateCommandPlan(
      plan({
        intent: "CREATE_PURCHASE",
        input: {
          contactId: supplier._id,
          productId: product._id,
          quantity: 50,
          unitPrice: "3200",
          transport: "2500",
        },
        query: {},
      }),
      "command",
      catalog,
    );
    expect(result.canPreview).toBe(true);
    expect(result.input.kind).toBe("purchase");
  });
  it("maps AI-selected catalog names and aliases to server-owned IDs", () => {
    const result = validateCommandPlan(
      plan({
        intent: "CREATE_SALE",
        input: {
          contactName: "கிஷோர்",
          productName: "Sago",
          quantity: 10,
          unitPrice: "3000",
        },
        query: {},
      }),
      "Kishore ku pathu mootai sago kuduthen",
      catalog,
    );
    expect(result.input).toMatchObject({
      contactId: customer._id,
      productId: product._id,
      quantity: 10,
      unitPrice: "3000",
    });
    expect(result.canPreview).toBe(false);
  });
  it("reads all supplier transactions when unused provider fields are null", async () => {
    const optionalInput = Object.fromEntries(
      Object.keys(commandPlanSchema.shape.input.shape).map((key) => [
        key,
        null,
      ]),
    );
    const optionalQuery = Object.fromEntries(
      Object.keys(commandPlanSchema.shape.query.shape).map((key) => [
        key,
        null,
      ]),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        envelope({
          intent: "GET_TRANSACTION_DETAILS",
          input: { ...optionalInput, contactName: supplier.name },
          query: optionalQuery,
          candidateContactIds: [],
          clarification: [],
        }),
      ),
    );
    const result = await interpretCommand(
      "Show me all the transaction of ABC Mill.",
      catalog,
      options,
    );
    expect(result.input).toEqual({ contactId: supplier._id });
    expect(result.query).toEqual({});
    expect(result.clarification).toEqual([]);
    expect(result.canPreview).toBe(false);
  });
  it("rejects financial fields carried into a history query from pending context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        envelope(
          plan({
            input: { contactName: supplier.name, quantity: 50 },
            query: {},
          }),
        ),
      ),
    );
    await expect(
      interpretCommand("Show all transactions", catalog, options),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });
  it("asks which account to use when a customer and supplier share the model-selected name", () => {
    const duplicateCatalog = {
      ...catalog,
      suppliers: [{ ...supplier, name: customer.name }],
    };
    const queryPlan = plan({
      input: { contactName: customer.name },
      query: {},
    });
    const result = validateCommandPlan(
      queryPlan,
      "Show all Kishore transactions",
      duplicateCatalog,
    );
    expect(result.contactId).toBeUndefined();
    expect(result.candidates.map((candidate) => candidate._id)).toEqual([
      customer._id,
      supplier._id,
    ]);
    expect(result.clarification.length).toBeGreaterThan(0);
    const selected = validateCommandPlan(
      queryPlan,
      "Show all Kishore transactions",
      {
        ...duplicateCatalog,
        selectedContactId: supplier._id,
      },
    );
    expect(selected.contactId).toBe(supplier._id);
    expect(selected.candidates).toEqual([]);
    expect(selected.clarification).toEqual([]);
  });
  it("asks for a saved name when the model selects an unknown account", () => {
    const result = validateCommandPlan(
      plan({
        input: { contactName: "Unknown store" },
        query: {},
      }),
      "Unknown store transactions",
      catalog,
    );
    expect(result.contactId).toBeUndefined();
    expect(result.candidates).toEqual([]);
    expect(result.clarification.length).toBeGreaterThan(0);
    expect(result.canPreview).toBe(false);
  });
  it.each([
    { input: { contactId: "f".repeat(24) } },
    { input: { productId: "f".repeat(24) } },
    { candidateContactIds: ["f".repeat(24)] },
    { intent: "CREATE_SALE", input: { contactId: supplier._id } },
    { intent: "CREATE_PURCHASE", input: { contactId: customer._id } },
    { intent: "CREATE_SALE", input: { sourceId: "f".repeat(24) } },
    { intent: "CREATE_SALE", input: { sourceId: saleId } },
    { intent: "RECORD_CUSTOMER_PAYMENT", input: { sourceId: purchaseId } },
    { input: { quantity: 20 } },
    { query: { from: "2026-10-20", to: "2026-10-01" } },
  ])(
    "rejects invented IDs, wrong entity roles and incompatible query fields: %j",
    (overrides) => {
      expect(() =>
        validateCommandPlan(
          plan(overrides as Partial<CommandPlan>),
          "command",
          catalog,
        ),
      ).toThrowError(expect.objectContaining({ code: "AI_INVALID_RESPONSE" }));
    },
  );
  it("keeps an ambiguous account unresolved even if the model also supplied an ID", () => {
    const result = validateCommandPlan(
      plan({ candidateContactIds: [customer._id] }),
      "command",
      catalog,
    );
    expect(result.contactId).toBeUndefined();
    expect(result.candidates).toEqual(
      [customer].map(({ _id, name }) => ({ _id, name })),
    );
    expect(result.canPreview).toBe(false);
    expect(result.clarification.length).toBeGreaterThan(0);
  });
  it("applies only model-extracted corrections to a pending draft", () => {
    const result = validateCommandPlan(
      plan({
        intent: "UPDATE_PENDING_DRAFT",
        input: { quantity: 60 },
        query: {},
      }),
      "change it to sixty",
      {
        ...catalog,
        context: {
          pendingInput: { kind: "purchase", quantity: 50, unitPrice: "3200" },
        },
      },
    );
    expect(result.input).toMatchObject({
      kind: "purchase",
      quantity: 60,
      unitPrice: "3200",
    });
    expect(() =>
      validateCommandPlan(
        plan({ intent: "UPDATE_PENDING_DRAFT", input: { quantity: 60 } }),
        "command",
        { ...catalog, context: {} },
      ),
    ).toThrowError(expect.objectContaining({ code: "NO_PENDING_DRAFT" }));
  });
  it.each([
    { intent: "RUN_SQL" },
    { input: { unitPrice: 3000 } },
    { input: { quantity: 1.5 } },
    { input: { date: "2026-02-31" } },
    { input: { kind: "sale" } },
    { query: { $where: "code" } },
    { answer: "Invented balance" },
  ])("rejects malformed model plans: %j", (overrides) => {
    expect(
      commandPlanSchema.safeParse({ ...plan(), ...overrides }).success,
    ).toBe(false);
  });
  it("never makes a request without a key and never falls back to the old parser", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      interpretCommand("50 bags bought", catalog, { ...options, apiKey: "" }),
    ).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    [400, "AI_CONFIGURATION"],
    [401, "AI_CONFIGURATION"],
    [403, "AI_CONFIGURATION"],
    [404, "AI_CONFIGURATION"],
    [429, "AI_RATE_LIMIT"],
    [500, "AI_UNAVAILABLE"],
  ])(
    "handles HTTP %s without exposing provider bodies or retrying",
    async (status, code) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("private-test-key confidential command", {
          status: Number(status),
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const error = await extractCommand("command", catalog, options).catch(
        (error) => error,
      );
      expect(error.code).toBe(code);
      expect(String(error)).not.toContain("private-test-key");
      expect(String(error)).not.toContain("confidential");
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );
  it("respects a provider cooldown across commands and resumes after its deadline", async () => {
    let now = 1000000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("private quota details", {
          status: 429,
          headers: { "retry-after": "10" },
        }),
      )
      .mockResolvedValueOnce(envelope(plan()));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      extractCommand("first command", catalog, options),
    ).rejects.toMatchObject({ code: "AI_RATE_LIMIT", retryAfterSeconds: 10 });
    now += 3000;
    await expect(
      extractCommand("different command", catalog, options),
    ).rejects.toMatchObject({ code: "AI_RATE_LIMIT", retryAfterSeconds: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now += 7000;
    await expect(
      extractCommand("first command", catalog, options),
    ).resolves.toMatchObject({ intent: "GET_TRANSACTION_DETAILS" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([
    [{}, 60],
    [{ "retry-after": "bad" }, 60],
    [{ "retry-after": "-1" }, 60],
    [{ "retry-after": "1.2" }, 2],
    [
      {
        "retry-after": "2",
        "x-ratelimit-remaining-tokens": "0",
        "x-ratelimit-reset-tokens": "2m59.56s",
      },
      180,
    ],
    [
      {
        "retry-after": "5",
        "x-ratelimit-remaining-requests": "0",
        "x-ratelimit-reset-requests": "1h2m",
      },
      3720,
    ],
    [
      {
        "retry-after": "2",
        "x-ratelimit-remaining-requests": "100",
        "x-ratelimit-reset-requests": "23h",
      },
      2,
    ],
    [
      {
        "x-ratelimit-remaining-tokens": "0",
        "x-ratelimit-reset-tokens": "500ms",
      },
      1,
    ],
  ])("uses a safe wait for quota headers %j", async (headers, seconds) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("private provider body", {
          status: 429,
          headers: headers as HeadersInit,
        }),
      ),
    );
    await expect(
      extractCommand("command", catalog, options),
    ).rejects.toMatchObject({
      code: "AI_RATE_LIMIT",
      retryAfterSeconds: seconds,
    });
  });
  it("trims repeated context without truncating the current command or removing pending fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope(plan()));
    vi.stubGlobal("fetch", fetchMock);
    const command = "கிஷோருக்கு ".repeat(100);
    const pendingInput = {
      kind: "purchase" as const,
      date: indiaDate(),
      quantity: 10,
      transport: "2500",
    };
    const pendingQuestion = {
      field: "unitPrice",
      question: "What price?",
      choices: [],
      id: "ui-only-id",
      questionTamil: "UI-only Tamil copy",
    };
    await extractCommand(
      command,
      {
        ...catalog,
        context: { pendingInput, pendingQuestion },
        recentMessages: Array.from({ length: 4 }, () => ({
          text: "x".repeat(400),
          intent: "CREATE_PURCHASE",
        })),
      },
      options,
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    const payload = JSON.parse(body.messages[1].content);
    expect(body.messages[0].content.length).toBeLessThan(4300);
    expect(payload.command).toBe(command);
    expect(payload.context.pendingInput).toEqual(pendingInput);
    expect(payload.context.pendingQuestion).toEqual({
      field: "unitPrice",
      question: "What price?",
      choices: [],
    });
    expect(payload.recentMessages).toHaveLength(2);
    expect(
      payload.recentMessages.every(
        (message: { text: string }) => message.text.length === 200,
      ),
    ).toBe(true);
  });
  it.each([
    envelope("not JSON"),
    envelope(plan(), "length"),
    Response.json({ choices: [] }),
    envelope({ intent: "NOT_A_REAL_INTENT" }),
    envelope({
      ...plan(),
      input: { contactName: customer.name, $where: "code" },
    }),
    envelope({ ...plan(), query: { $where: "code" } }),
    envelope({ ...plan(), answer: "Invented balance" }),
  ])("rejects unreadable, truncated and empty results", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(
      extractCommand("command", catalog, options),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });
  it("distinguishes network errors and timeouts safely", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private-key")));
    await expect(
      extractCommand("command", catalog, options),
    ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
    await expect(
      extractCommand("command", catalog, options),
    ).rejects.toMatchObject({ code: "AI_TIMEOUT" });
  });
});
