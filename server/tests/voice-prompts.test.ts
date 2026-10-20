import { beforeEach, describe, it, expect, vi } from "vitest";
const native = vi.hoisted(() => ({
  optional: vi.fn(),
  speak: vi.fn(),
  stop: vi.fn(),
  voices: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo", () => ({ requireOptionalNativeModule: native.optional }));
vi.mock("expo-speech", () => ({
  speak: native.speak,
  stop: native.stop,
  getAvailableVoicesAsync: native.voices,
}));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  native.optional.mockReturnValue({});
  native.stop.mockResolvedValue(undefined);
  native.voices.mockResolvedValue([
    { identifier: "english-india", language: "en-IN", quality: "Default" },
    { identifier: "tamil-india", language: "ta-IN", quality: "Default" },
  ]);
});
// Keep native SDK global declarations out of the Node server typecheck.
const load = () =>
  vi.importActual<{
    speakVoicePrompt: (
      text: string,
      language: "ta" | "en",
      onUnavailable?: () => void,
    ) => Promise<boolean>;
    stopVoicePrompt: () => Promise<void>;
    followUpSpeechText: (
      question: {
        field: string;
        question: string;
        questionTamil: string;
        choices: { value: string; label: string; speechLabelTamil?: string }[];
      },
      language: "ta" | "en",
    ) => string;
  }>("../../mobile/services/voice-prompts.ts");
describe("spoken follow-up prompts", () => {
  it("keeps the app usable when an older native build lacks speech output", async () => {
    native.optional.mockReturnValue(null);
    const { speakVoicePrompt } = await load();
    await expect(speakVoicePrompt("How many bags?", "en")).resolves.toBe(false);
    expect(native.speak).not.toHaveBeenCalled();
  });
  it("speaks the chosen language and stops output before recording", async () => {
    const { speakVoicePrompt, stopVoicePrompt } = await load();
    expect(await speakVoicePrompt("எத்தனை மூட்டைகள்?", "ta")).toBe(true);
    expect(native.speak).toHaveBeenCalledWith(
      "எத்தனை மூட்டைகள்?",
      expect.objectContaining({ language: "ta-IN" }),
    );
    await stopVoicePrompt();
    expect(native.stop).toHaveBeenCalledTimes(2);
  });
  it("does not start a late prompt after the user has already tapped reply", async () => {
    const { speakVoicePrompt, stopVoicePrompt } = await load();
    const pending = speakVoicePrompt("How many bags?", "en");
    await stopVoicePrompt();
    expect(await pending).toBe(false);
    expect(native.speak).not.toHaveBeenCalled();
  });
  it("selects the enhanced Tamil India voice rather than the device's default English voice", async () => {
    native.voices.mockResolvedValue([
      { identifier: "english", language: "en-US", quality: "Enhanced" },
      { identifier: "tamil-default", language: "ta-IN", quality: "Default" },
      { identifier: "tamil-enhanced", language: "ta_IN", quality: "Enhanced" },
      {
        identifier: "tamil-other-region",
        language: "ta-LK",
        quality: "Enhanced",
      },
    ]);
    const { speakVoicePrompt } = await load();
    expect(await speakVoicePrompt("ஒரு மூட்டையின் விலை என்ன?", "ta")).toBe(
      true,
    );
    expect(native.speak).toHaveBeenCalledWith(
      "ஒரு மூட்டையின் விலை என்ன?",
      expect.objectContaining({
        voice: "tamil-enhanced",
        language: "ta-IN",
        rate: 0.9,
      }),
    );
  });
  it("speaks English store names separately from native-script Tamil questions", async () => {
    const { speakVoicePrompt } = await load();
    await speakVoicePrompt(
      "எந்த வாடிக்கையாளர்? Wow Store. எத்தனை மூட்டைகள்?",
      "ta",
    );
    expect(
      native.speak.mock.calls.map(([text, options]) => [
        text,
        options.language,
        options.voice,
      ]),
    ).toEqual([
      ["எந்த வாடிக்கையாளர்?", "ta-IN", "tamil-india"],
      ["Wow Store.", "en-IN", "english-india"],
      ["எத்தனை மூட்டைகள்?", "ta-IN", "tamil-india"],
    ]);
  });
  it("uses English for an English clarification even when the interface language is Tamil", async () => {
    const { speakVoicePrompt } = await load();
    await speakVoicePrompt("Which saved product is this?", "ta");
    expect(native.speak).toHaveBeenCalledWith(
      "Which saved product is this?",
      expect.objectContaining({ language: "en-IN", voice: "english-india" }),
    );
  });
  it("reports missing Tamil voice data rather than reading Tamil with an English default", async () => {
    native.voices.mockResolvedValue([
      { identifier: "english", language: "en-IN", quality: "Default" },
    ]);
    const unavailable = vi.fn();
    const { speakVoicePrompt } = await load();
    expect(await speakVoicePrompt("எத்தனை மூட்டைகள்?", "ta", unavailable)).toBe(
      false,
    );
    expect(unavailable).toHaveBeenCalledOnce();
    expect(native.speak).not.toHaveBeenCalled();
  });
  it("cancels pending voice discovery when the microphone opens without showing an unavailable warning", async () => {
    let finish!: (voices: unknown[]) => void;
    native.voices.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { speakVoicePrompt, stopVoicePrompt } = await load();
    const unavailable = vi.fn();
    const pending = speakVoicePrompt("எத்தனை மூட்டைகள்?", "ta", unavailable);
    await vi.waitFor(() => expect(native.voices).toHaveBeenCalled());
    await stopVoicePrompt();
    finish([{ identifier: "tamil", language: "ta-IN", quality: "Default" }]);
    expect(await pending).toBe(false);
    expect(native.speak).not.toHaveBeenCalled();
    expect(unavailable).not.toHaveBeenCalled();
  });
  it("keeps replies usable when voice discovery fails", async () => {
    native.voices.mockRejectedValue(new Error("Speech engine unavailable"));
    const unavailable = vi.fn();
    const { speakVoicePrompt } = await load();
    expect(await speakVoicePrompt("எத்தனை மூட்டைகள்?", "ta", unavailable)).toBe(
      false,
    );
    expect(unavailable).toHaveBeenCalledOnce();
    expect(native.speak).not.toHaveBeenCalled();
  });
  it("does not wait indefinitely when the browser never publishes its voices", async () => {
    const { speakVoicePrompt } = await load();
    vi.useFakeTimers();
    native.voices.mockImplementation(() => new Promise(() => {}));
    const unavailable = vi.fn();
    const pending = speakVoicePrompt("எத்தனை மூட்டைகள்?", "ta", unavailable);
    await vi.waitFor(() => expect(native.voices).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toBe(false);
    expect(unavailable).toHaveBeenCalledOnce();
    expect(native.speak).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it("stops the remaining queued phrases on a playback error", async () => {
    const { speakVoicePrompt } = await load();
    const unavailable = vi.fn();
    await speakVoicePrompt("எந்த வாடிக்கையாளர்? Wow Store", "ta", unavailable);
    native.speak.mock.calls[0]![1].onError(new Error("Playback failed"));
    expect(native.stop).toHaveBeenCalledTimes(2);
    expect(unavailable).toHaveBeenCalledOnce();
  });
  it("uses saved Tamil pronunciation aliases only for speech and preserves displayed option numbers", async () => {
    const { followUpSpeechText } = await load();
    const question = {
      field: "sourceId",
      question: "Which lot?",
      questionTamil: "எந்த கொள்முதல்?",
      choices: [
        { value: "3", label: "Wow Store", speechLabelTamil: "வாவ் ஸ்டோர்" },
      ],
    };
    expect(followUpSpeechText(question, "ta")).toBe(
      "எந்த கொள்முதல்? விருப்பம் 3. வாவ் ஸ்டோர்.",
    );
    expect(followUpSpeechText(question, "en")).toBe(
      "Which lot? Option 3. Wow Store.",
    );
    expect(question.choices[0]!.label).toBe("Wow Store");
  });
});
