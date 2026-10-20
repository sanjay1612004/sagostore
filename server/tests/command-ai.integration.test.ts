import { describe, it, expect } from "vitest";
import { indiaDate } from "@tamiltrade/shared";
import {
  interpretCommand,
  type CommandCatalog,
} from "../src/modules/command-ai.js";
const enabled = process.env.RUN_GROQ_INTEGRATION === "1";
const customer = { _id: "a".repeat(24), name: "Kishore" };
const vishal = { _id: "b".repeat(24), name: "Vishal" };
const supplier = { _id: "c".repeat(24), name: "ABC Mill" };
const product = { _id: "d".repeat(24), name: "Sago", unit: "bag" };
const catalog: CommandCatalog = {
  customers: [customer, vishal],
  suppliers: [supplier],
  products: [product],
  context: {},
};
describe.skipIf(!enabled)(
  "live Groq command understanding with fictional catalog",
  () => {
    const options = {
      apiKey: process.env.GROQ_API_KEY ?? "",
      model: "qwen/qwen3.8-27b",
      timeoutMs: 25000,
    };
    it("keeps a Tamil-named product and asks for the account on an incomplete spoken sale", async () => {
      const result = await interpretCommand(
        "100 மூட்டை ஜவ்வரிசி கொடுத்தேன். ஒரு மூட்டையோட விலை வந்து ₹1000. இதை note பண்ணி வச்சுக்கோ.",
        {
          customers: [{ ...customer, name: "Preview Customer", aliases: [] }],
          suppliers: [{ ...supplier, name: "Preview Mill" }],
          products: [{ ...product, name: "ஜவ்வரிசி" }],
          context: {},
        },
        options,
      );
      expect(result.intent).toBe("CREATE_SALE");
      expect(result.input).toMatchObject({
        productId: product._id,
        quantity: 100,
        unitPrice: "1000",
      });
      expect(result.input.contactId).toBeUndefined();
      expect(result.input.sourceId).toBeUndefined();
      expect(result.missing).toContain("contactId");
      expect(result.canPreview).toBe(false);
    }, 30000);
    it("understands the mixed-language sale from the rate-limit screenshot without guessing its product", async () => {
      const wow = { _id: "f".repeat(24), name: "Wow Store" };
      const result = await interpretCommand(
        "இன்னைக்கு Wow Store-ல 100 மூட்டை sell பண்ணேன். ஒரு மூட்டையோட விலை வந்து 100. இதை note பண்ணி வச்சுக்கோ.",
        { ...catalog, customers: [...catalog.customers, wow] },
        options,
      );
      expect(result.intent).toBe("CREATE_SALE");
      expect(
        result.input,
        JSON.stringify({
          input: result.input,
          candidates: result.candidates,
          clarification: result.clarification,
        }),
      ).toMatchObject({
        contactId: wow._id,
        quantity: 100,
        unitPrice: "100",
      });
      expect(result.input.productId).toBeUndefined();
      expect(result.input.sourceId).toBeUndefined();
      expect(result.canPreview).toBe(false);
    }, 30000);
    it("understands a voice follow-up with mixed Tamil and English and keeps the pending account", async () => {
      const result = await interpretCommand(
        "pathu mootai, oru bag 3200 rupees",
        {
          ...catalog,
          context: {
            pendingInput: {
              kind: "purchase",
              date: indiaDate(),
              contactId: supplier._id,
              productId: product._id,
              transport: "500",
            },
            pendingQuestion: {
              field: "quantity",
              question: "How many units or bags?",
              choices: [],
            },
          },
        },
        options,
      );
      expect(result.intent).toBe("UPDATE_PENDING_DRAFT");
      expect(result.input).toMatchObject({
        kind: "purchase",
        contactId: supplier._id,
        productId: product._id,
        quantity: 10,
        unitPrice: "3200",
        transport: "500",
      });
      expect(result.canPreview).toBe(true);
      expect(result.clarification).toEqual([]);
    }, 30000);
    it.each([
      {
        text: "How much sales has happened today?",
        intent: "GET_DAILY_SALES",
        input: {},
        query: { date: indiaDate() },
      },
      {
        text: "Show me all the transaction of Kishore.",
        intent: "GET_TRANSACTION_DETAILS",
        input: { contactId: customer._id },
        query: {},
      },
      {
        text: "நான் வந்து கிஷோருக்கு எவ்வளோ மூட்டை ஜவ்வரிசி கொடுத்தேன் அதோட விலை என்ன அதை பற்றி எனக்கு details கொடு.",
        intent: "GET_TRANSACTION_DETAILS",
        input: { contactId: customer._id, productId: product._id },
        query: { kind: "sale" },
      },
      {
        text: "Vishalukku pathu mootai javvarisi kuduthen, oru mootaiyoda vilai vandhu 3000 rupees",
        intent: "CREATE_SALE",
        input: {
          contactId: vishal._id,
          productId: product._id,
          quantity: 10,
          unitPrice: "3000",
        },
      },
      {
        text: "ABC Millல இருந்து fifty bags sago வாங்கினேன். ஒவ்வொரு மூட்டைக்கும் 3200 rupees. லாரி வாடகை 2500.",
        intent: "CREATE_PURCHASE",
        input: {
          contactId: supplier._id,
          productId: product._id,
          quantity: 50,
          unitPrice: "3200",
          transport: "2500",
        },
      },
    ])(
      "understands $intent: $text",
      async (fixture) => {
        const commandCatalog =
          fixture.intent === "GET_DAILY_SALES"
            ? {
                ...catalog,
                context: {
                  contactId: customer._id,
                  pendingInput: {
                    kind: "purchase" as const,
                    quantity: 50,
                    unitPrice: "3200",
                  },
                },
                recentMessages: [
                  {
                    text: "Show me all the transaction of Kishore.",
                    intent: "GET_TRANSACTION_DETAILS",
                  },
                ],
              }
            : catalog;
        const result = await interpretCommand(
          fixture.text,
          commandCatalog,
          options,
        );
        expect(result.intent).toBe(fixture.intent);
        expect(result.input).toMatchObject(fixture.input);
        if (fixture.query) {
          expect(result.query).toMatchObject(fixture.query);
          if (!Object.keys(fixture.query).length) {
            expect(result.query).toEqual({});
            expect(result.input.productId).toBeUndefined();
          }
        }
        if (fixture.intent === "GET_TRANSACTION_DETAILS")
          expect(result.input.kind).toBeUndefined();
        if (fixture.intent === "GET_DAILY_SALES") {
          expect(result.input).toEqual({});
          expect(result.clarification).toEqual([]);
          expect(result.canPreview).toBe(false);
        }
        if (fixture.intent === "CREATE_SALE") {
          expect(result.input.sourceId).toBeUndefined();
          expect(result.canPreview).toBe(false);
        }
        if (fixture.intent === "CREATE_PURCHASE")
          expect(result.canPreview).toBe(true);
      },
      30000,
    );
  },
);
