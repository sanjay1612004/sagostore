import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

let speech: typeof import("expo-speech") | undefined;
let generation = 0;

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

export async function speakVoicePrompt(text: string, language: "ta" | "en") {
  const current = ++generation;
  const engine = await speechEngine();
  if (!engine || current !== generation) return false;
  try {
    await engine.stop();
    if (current !== generation) return false;
    engine.speak(text, {
      language: language === "ta" ? "ta-IN" : "en-IN",
      rate: 0.95,
    });
    return true;
  } catch {
    return false;
  }
}
