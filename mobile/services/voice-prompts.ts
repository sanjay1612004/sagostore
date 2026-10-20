import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

let speech: typeof import("expo-speech") | undefined;
let generation = 0;
type Language = "ta" | "en";
type Voice = Pick<
  import("expo-speech").Voice,
  "identifier" | "language" | "quality"
>;

function bestVoice(voices: Voice[], language: Language) {
  const locale = `${language}-in`;
  return voices
    .filter(
      (voice) =>
        voice.language.replaceAll("_", "-").toLowerCase().split("-")[0] ===
        language,
    )
    .sort((a, b) => {
      const score = (voice: Voice) =>
        (voice.language.replaceAll("_", "-").toLowerCase() === locale ? 2 : 0) +
        (voice.quality === "Enhanced" ? 1 : 0);
      return score(b) - score(a);
    })[0];
}

// Native-script Tamil is spoken by a Tamil voice. Latin-script names and
// English choice descriptions use English instead of being forced through it.
function speechParts(text: string, preferred: Language) {
  const parts: { text: string; language: Language }[] = [];
  let current = "";
  let language = preferred;
  let hasLetters = false;
  for (const char of text.normalize("NFC")) {
    const next = /\p{Script=Tamil}/u.test(char)
      ? "ta"
      : /\p{Script=Latin}/u.test(char)
        ? "en"
        : undefined;
    if (next && hasLetters && next !== language) {
      if (current.trim()) parts.push({ text: current.trim(), language });
      current = "";
    }
    if (next) {
      language = next;
      hasLetters = true;
    }
    current += char;
  }
  if (current.trim()) parts.push({ text: current.trim(), language });
  return parts;
}

export function followUpSpeechText(
  question: {
    field: string;
    question: string;
    questionTamil: string;
    choices: { value: string; label: string; speechLabelTamil?: string }[];
  },
  language: Language,
) {
  const choices = question.choices
    .slice(0, 5)
    .map(
      (choice, index) =>
        `${language === "ta" ? "விருப்பம்" : "Option"} ${question.field === "sourceId" ? choice.value : index + 1}. ${language === "ta" ? (choice.speechLabelTamil ?? choice.label) : choice.label}`,
    );
  return [
    language === "ta" ? question.questionTamil : question.question,
    ...choices.map((choice) => (/[.!?]$/.test(choice) ? choice : `${choice}.`)),
  ].join(" ");
}

async function speechEngine() {
  if (speech) return speech;
  // Older installed builds may not contain the module; text questions and
  // recording remain usable rather than failing at application startup.
  if (Platform.OS !== "web" && !requireOptionalNativeModule("ExpoSpeech"))
    return undefined;
  try {
    speech = await import("expo-speech");
    return speech;
  } catch {
    return undefined;
  }
}

export async function stopVoicePrompt() {
  generation += 1;
  await speech?.stop().catch(() => undefined);
}

export async function speakVoicePrompt(
  text: string,
  language: Language,
  onUnavailable?: () => void,
) {
  const current = ++generation;
  const engine = await speechEngine();
  if (current !== generation) return false;
  const unavailable = () => {
    if (current === generation) onUnavailable?.();
    return false;
  };
  if (!engine) return unavailable();
  try {
    await engine.stop();
    if (current !== generation) return false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const voices = await Promise.race([
      engine.getAvailableVoicesAsync(),
      new Promise<Voice[]>((resolve) => {
        timer = setTimeout(() => resolve([]), 1500);
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
    if (current !== generation) return false;
    const parts = speechParts(text, language);
    const tamilVoice = bestVoice(voices, "ta"),
      englishVoice = bestVoice(voices, "en");
    // Android otherwise silently uses the default locale and misreads Tamil.
    if (parts.some((part) => part.language === "ta") && !tamilVoice)
      return unavailable();
    for (const part of parts) {
      if (current !== generation) return false;
      const voice = part.language === "ta" ? tamilVoice : englishVoice;
      engine.speak(part.text, {
        language: voice?.language.replaceAll("_", "-") ?? "en-IN",
        voice: voice?.identifier,
        rate: part.language === "ta" ? 0.9 : 0.95,
        pitch: 1,
        onError: () => {
          if (current !== generation) return;
          void stopVoicePrompt();
          onUnavailable?.();
        },
      });
    }
    return parts.length > 0;
  } catch {
    return unavailable();
  }
}
