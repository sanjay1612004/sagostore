import {
  contactSchema,
  productSchema,
  voiceCatalogFieldsSchema,
  type VoiceCatalogAction,
  type VoiceCatalogFields,
} from "@tamiltrade/shared";
import type { FollowUp } from "./voice-follow-up.js";

const contactKeys = [
  "name",
  "phone",
  "address",
  "aliases",
  "paymentTermsDays",
  "creditLimit",
] as const;
const productKeys = [
  "name",
  "category",
  "unit",
  "weightGrams",
  "lowStockQuantity",
  "quantity",
  "unitPrice",
  "quantityOptions",
] as const;

export const catalogHasStock = (action: VoiceCatalogAction) =>
  action.kind === "product" &&
  (action.purchaseInput?.kind === "purchase" ||
    action.input.quantity !== undefined ||
    action.input.unitPrice !== undefined ||
    !!action.input.quantityOptions?.length);

export function validateCatalogAction(
  kind: VoiceCatalogAction["kind"],
  fields: VoiceCatalogFields,
) {
  const keys = kind === "product" ? productKeys : contactKeys;
  const input = Object.fromEntries(
    keys
      .filter((key) => fields[key] !== undefined)
      .map((key) => [key, fields[key]]),
  ) as VoiceCatalogFields;
  const ambiguousQuantity =
    kind === "product" && !!input.quantityOptions?.length;
  if (ambiguousQuantity) delete input.quantity;
  const quantityRequired =
    kind === "product" &&
    (ambiguousQuantity ||
      (input.unitPrice !== undefined && input.quantity === undefined));
  // Names and a product's trading unit/weight must be supplied explicitly.
  // Optional defaults match the manual form and are displayed during review.
  const schema =
    kind === "product"
      ? productSchema.extend({
          unit: productSchema.shape.unit.removeDefault(),
          weightGrams: productSchema.shape.weightGrams.removeDefault(),
          quantity: voiceCatalogFieldsSchema.shape.quantity,
          unitPrice: voiceCatalogFieldsSchema.shape.unitPrice,
          quantityOptions: voiceCatalogFieldsSchema.shape.quantityOptions,
        })
      : contactSchema.omit({ kind: true });
  const parsed = schema.safeParse(input);
  return {
    action: {
      kind,
      input: parsed.success ? parsed.data : input,
    } as VoiceCatalogAction,
    missing: [
      ...(quantityRequired ? ["quantity"] : []),
      ...(parsed.success
        ? []
        : [
            ...new Set(
              parsed.error.issues.map((issue) => String(issue.path[0])),
            ),
          ]),
    ],
    valid: parsed.success && !quantityRequired,
  };
}

export function catalogVoiceQuestion(
  action: VoiceCatalogAction,
  missing: string[],
  clarification: string[],
): FollowUp | undefined {
  const field = clarification.some((message) =>
    message.includes("already exists"),
  )
    ? "name"
    : [
        "name",
        "phone",
        "unit",
        "quantity",
        "weightGrams",
        "paymentTermsDays",
        "creditLimit",
        "lowStockQuantity",
        "address",
        "aliases",
        "category",
      ].find((key) => missing.includes(key));
  const names = {
    customer: ["What is the customer's name?", "வாடிக்கையாளரின் பெயர் என்ன?"],
    supplier: [
      "What is the supplier's name?",
      "பொருளை வழங்குபவரின் பெயர் என்ன?",
    ],
    product: ["What is the product name?", "பொருளின் பெயர் என்ன?"],
  };
  const questions: Record<string, string[]> = {
    name: names[action.kind],
    phone: [
      "Please say the phone number again, digit by digit.",
      "தொலைபேசி எண்ணை ஒவ்வொரு இலக்கமாகச் சொல்லுங்கள்.",
    ],
    unit: [
      "What is the trading unit: bag, kg, carton, or another unit?",
      "எந்த அலகில் விற்கிறீர்கள்? மூட்டை, கிலோ அல்லது பெட்டியா?",
    ],
    quantity: [
      action.input.quantityOptions?.length
        ? `You mentioned different quantities. Did you buy ${action.input.quantityOptions.map((count) => `${count} ${action.input.unit === "bag" ? "bags" : (action.input.unit ?? "units")}`).join(" or ")}?`
        : "How many units or bags did you buy?",
      action.input.quantityOptions?.length
        ? "நீங்கள் வெவ்வேறு எண்ணிக்கைகளைச் சொன்னீர்கள். சரியாக எத்தனை மூட்டைகள் வாங்கினீர்கள்?"
        : "எத்தனை மூட்டைகள் அல்லது பொருட்கள் வாங்கினீர்கள்?",
    ],
    weightGrams: [
      "How much does one trading unit weigh? For example, 50 kilograms per bag.",
      "ஒரு மூட்டை அல்லது ஒரு பொருளின் எடை எவ்வளவு? உதாரணமாக, ஒரு மூட்டை ஐம்பது கிலோ.",
    ],
    paymentTermsDays: [
      "How many days are allowed for payment?",
      "பணம் செலுத்த எத்தனை நாட்கள் அவகாசம்?",
    ],
    creditLimit: [
      "What is the credit limit in rupees? Say zero for no enforced limit.",
      "கடன் வரம்பு எத்தனை ரூபாய்? வரம்பு வேண்டாம் என்றால் பூஜ்ஜியம் என்று சொல்லுங்கள்.",
    ],
    lowStockQuantity: [
      "At how many units should the low-stock alert appear?",
      "இருப்பு எத்தனை பொருட்களாகக் குறையும்போது எச்சரிக்க வேண்டும்?",
    ],
    address: [
      "What address should be saved?",
      "எந்த முகவரியைச் சேமிக்க வேண்டும்?",
    ],
    aliases: [
      "What other names do you use for this contact?",
      "இந்த நபரை வேறு எந்தப் பெயர்களில் அழைப்பீர்கள்?",
    ],
    category: ["What is the product category?", "இந்தப் பொருளின் வகை என்ன?"],
  };
  if (!field && !clarification.length) return undefined;
  const duplicate = clarification.find((message) =>
    message.includes("already exists"),
  );
  const [question, questionTamil] = duplicate
    ? [
        duplicate,
        "இந்தப் பெயர் ஏற்கனவே உள்ளது. புதிய பதிவுக்கு வேறு பெயரைச் சொல்லுங்கள், அல்லது ரத்து செய்யுங்கள்.",
      ]
    : field
      ? questions[field]!
      : [
          clarification[0]!,
          "விவரத்தை மீண்டும் தெளிவாகச் சொல்லுங்கள், அல்லது ரத்து செய்யுங்கள்.",
        ];
  return {
    field: field ?? "name",
    question: question!,
    questionTamil: questionTamil!,
    choices:
      field === "quantity"
        ? [...new Set(action.input.quantityOptions ?? [])].map((count) => ({
            value: String(count),
            label: `${count} ${action.input.unit === "bag" ? "bags" : (action.input.unit ?? "units")}`,
            ...(action.input.unit === "bag"
              ? { speechLabelTamil: `${count} மூட்டைகள்` }
              : {}),
          }))
        : [],
  };
}
