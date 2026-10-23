// A vocabulary hint, not an instruction or an example transaction. Never seed amounts.
const vocabulary =
  "வாங்கினேன், விற்றேன், மூட்டை, கிலோ, ரூபாய், விலை, லாரி வாடகை, பாக்கி, GPay";

// A free-form recording may introduce an unfamiliar person or product. Only
// boost saved spellings when the user is answering displayed entity choices.
export function speechChoiceNames(context?: {
  pendingCatalogAction?: unknown;
  pendingQuestion?: {
    field?: string;
    choices?: { label: string }[];
  };
}) {
  if (context?.pendingCatalogAction) return [];
  const question = context?.pendingQuestion;
  return question?.field === "contactId" || question?.field === "productId"
    ? (question.choices ?? []).map((choice) => choice.label)
    : [];
}

// Saaras v4 accepts at most 50 distinct phrases of up to 64 characters.
// Hints help recognition; never insert them into a returned transcript.
export function speechKeyterms(names: string[]) {
  const terms: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const term = name.normalize("NFC").replace(/\s+/gu, " ").trim();
    const key = term.toLocaleLowerCase("en");
    if (!term || Array.from(term).length > 64 || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length === 50) break;
  }
  return terms;
}

export function tamilSpeechPrompt(names: string[] = []) {
  const terms = [
    ...new Set(
      names
        .map((name) =>
          name
            .normalize("NFC")
            .replace(/[\r\n,]+/g, " ")
            .trim(),
        )
        .filter(Boolean),
    ),
  ];
  // Whisper has a short prompt window; keep hints bounded and local to this business.
  return Array.from([vocabulary, ...terms].join(", "))
    .slice(0, 300)
    .join("");
}

export function tamilSpeechForm(
  wav: Uint8Array,
  prompt: string,
  beamSize: number,
) {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(wav)], { type: "audio/wav" }),
    "command.wav",
  );
  form.append("language", "ta");
  form.append("translate", "false");
  form.append("detect_language", "false");
  form.append("response_format", "json");
  form.append("temperature", "0.0");
  form.append("beam_size", String(beamSize));
  form.append("prompt", prompt);
  return form;
}
