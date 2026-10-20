import { describe, it, expect } from "vitest";
import { nextVoiceQuestion } from "../src/modules/voice-follow-up.js";

const catalog = {
  customers: [{ _id: "a".repeat(24), name: "Kishore" }],
  suppliers: [{ _id: "b".repeat(24), name: "ABC Mill" }],
  products: [],
};
const result = {
  input: { kind: "purchase" as const },
  missing: ["unitPrice", "quantity", "contactId"],
  candidates: [],
  clarification: [],
  canPreview: false,
};
describe("voice questions", () => {
  it("asks one missing detail at a time in both languages and offers the correct account role", () => {
    const account = nextVoiceQuestion(result, catalog, []);
    expect(account?.field).toBe("contactId");
    expect(account?.choices).toEqual([
      { value: catalog.suppliers[0]!._id, label: "ABC Mill" },
    ]);
    expect(account?.questionTamil).toMatch(/[\u0b80-\u0bff]/);
    expect(
      nextVoiceQuestion(
        { ...result, missing: ["quantity", "unitPrice"] },
        catalog,
        [],
      )?.field,
    ).toBe("quantity");
    expect(
      nextVoiceQuestion({ ...result, missing: ["unitPrice"] }, catalog, [])
        ?.field,
    ).toBe("unitPrice");
  });
  it("offers explicit source choices and explains when no eligible lot exists", () => {
    const sale = {
      ...result,
      input: { kind: "sale" as const },
      missing: ["sourceId"],
    };
    const question = nextVoiceQuestion(sale, catalog, [
      { _id: "c".repeat(24), option: 2, kind: "purchase", label: "Lot two" },
    ]);
    expect(question?.choices).toEqual([{ value: "2", label: "Lot two" }]);
    expect(nextVoiceQuestion(sale, catalog, [])?.question).toContain(
      "No eligible saved transaction",
    );
  });
  it("does not ask optional questions or speak after the draft is complete", () => {
    expect(
      nextVoiceQuestion(
        { ...result, missing: [], canPreview: true },
        catalog,
        [],
      ),
    ).toBeUndefined();
  });
});
