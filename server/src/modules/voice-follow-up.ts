import { rupees, type Entity, type TradeInput } from "@tamiltrade/shared";
import { Record } from "./models.js";
import type { CommandSource } from "./command-ai.js";

export type FollowUp = {
  field: string;
  question: string;
  questionTamil: string;
  choices: { value: string; label: string; speechLabelTamil?: string }[];
};

export async function voiceSourceOptions(
  businessId: string,
  input: Partial<TradeInput>,
  previousIds: string[] = [],
): Promise<CommandSource[]> {
  const sale = input.kind === "sale";
  const payment =
    input.kind === "customer_payment" || input.kind === "supplier_payment";
  if (
    (!sale && !payment) ||
    (sale && !input.productId) ||
    (payment && !input.contactId)
  )
    return [];
  const rows = await Record.find({
    businessId,
    status: "posted",
    kind: sale || input.kind === "supplier_payment" ? "purchase" : "sale",
    ...(sale
      ? {
          productId: input.productId,
          delivery: input.delivery ?? "warehouse",
          $expr: { $gt: ["$quantity", "$allocatedQuantity"] },
        }
      : { contactId: input.contactId, $expr: { $gt: ["$total", "$paid"] } }),
    ...(previousIds.length ? { _id: { $in: previousIds } } : {}),
  })
    .select(
      "kind date contactId productId contactName productName quantity allocatedQuantity total paid delivery",
    )
    .sort({ date: -1, _id: -1 })
    .limit(10)
    .lean();
  return rows
    .map((row, index) => {
      const _id = String(row._id);
      const option = previousIds.length
        ? previousIds.indexOf(_id) + 1
        : index + 1;
      const remaining = row.quantity - row.allocatedQuantity;
      return {
        _id,
        option,
        kind: row.kind as "purchase" | "sale",
        contactId: row.contactId?.toString(),
        productId: row.productId?.toString(),
        delivery: row.delivery,
        label: `${row.date} · ${row.contactName ?? "Account"} · ${sale ? `${remaining} units available` : `${rupees(row.total - row.paid)} remaining`}`,
      };
    })
    .sort((a, b) => a.option - b.option);
}

export function nextVoiceQuestion(
  result: {
    input: Partial<TradeInput>;
    missing: string[];
    clarification: string[];
    candidates: { _id: string; name: string }[];
    canPreview: boolean;
  },
  catalog: { customers: Entity[]; suppliers: Entity[]; products: Entity[] },
  sources: CommandSource[],
): FollowUp | undefined {
  if (!result.input.kind || result.canPreview) return undefined;
  const input = result.input;
  const supplier =
    input.kind === "purchase" || input.kind === "supplier_payment";
  const contacts = supplier ? catalog.suppliers : catalog.customers;
  const field = result.candidates.length
    ? "contactId"
    : [
        "contactId",
        "productId",
        "quantity",
        "unitPrice",
        "sourceId",
        "amount",
        "date",
        "dueDate",
      ].find((key) => result.missing.includes(key));
  const options = (items: Entity[]) =>
    items.slice(0, 10).map((item) => {
      const tamilName = [item.name, ...(item.aliases ?? [])].find((name) =>
        /\p{Script=Tamil}/u.test(name),
      );
      return {
        value: item._id,
        label: item.name,
        ...(tamilName ? { speechLabelTamil: tamilName } : {}),
      };
    });
  const questions: Record<string, [string, string]> = {
    contactId: [
      supplier ? "Which supplier is this for?" : "Which customer is this for?",
      supplier
        ? "பொருளை வழங்கியவர் யார்? பெயரைச் சொல்லுங்கள்."
        : "எந்த வாடிக்கையாளர்? பெயரைச் சொல்லுங்கள்.",
    ],
    productId: [
      "Which product? Say its saved name.",
      "எந்தப் பொருள்? சேமித்துள்ள பெயரைச் சொல்லுங்கள்.",
    ],
    quantity: ["How many units or bags?", "எத்தனை மூட்டைகள் அல்லது பொருட்கள்?"],
    unitPrice: [
      "What is the price for one unit or bag?",
      "ஒரு மூட்டை அல்லது ஒரு பொருளின் விலை எவ்வளவு?",
    ],
    amount: [
      "What is the payment or expense amount?",
      "செலுத்தும் தொகை அல்லது செலவு எவ்வளவு?",
    ],
    date: ["What is the transaction date?", "பரிவர்த்தனை தேதி என்ன?"],
    dueDate: [
      "What is the due date? It must be on or after the transaction date.",
      "பணம் செலுத்த வேண்டிய தேதி என்ன? அது பரிவர்த்தனைத் தேதி அல்லது அதற்குப் பிந்தைய தேதியாக இருக்க வேண்டும்.",
    ],
    sourceId: [
      input.kind === "sale"
        ? "Which purchase lot should this sale use? Say an option number."
        : "Which outstanding transaction is this payment for? Say an option number.",
      input.kind === "sale"
        ? "எந்த கொள்முதல் மூட்டைகளிலிருந்து விற்கிறீர்கள்? விருப்ப எண்ணைச் சொல்லுங்கள்."
        : "எந்த பாக்கி பரிவர்த்தனைக்கு இந்தத் தொகை? விருப்ப எண்ணைச் சொல்லுங்கள்.",
    ],
  };
  if (field) {
    const [question, questionTamil] = questions[field]!;
    return {
      field,
      question:
        field === "sourceId" && !sources.length
          ? "No eligible saved transaction is available. You can correct the product/account, or cancel this draft."
          : question,
      questionTamil:
        field === "sourceId" && !sources.length
          ? "பொருத்தமான சேமித்த பரிவர்த்தனை இல்லை. பொருள் அல்லது கணக்கைத் திருத்தலாம், அல்லது இந்த வரைவை ரத்து செய்யலாம்."
          : questionTamil,
      choices:
        field === "contactId"
          ? options(result.candidates.length ? result.candidates : contacts)
          : field === "productId"
            ? options(catalog.products)
            : field === "sourceId"
              ? sources.map((source) => ({
                  value: String(source.option),
                  label: source.label,
                }))
              : [],
    };
  }
  if (result.clarification.length)
    return {
      field: "clarification",
      question: result.clarification[0]!,
      questionTamil: result.clarification[0]!,
      choices: [],
    };
  return undefined;
}
