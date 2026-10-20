import { beforeEach, describe, it, expect, vi } from "vitest";
const native = vi.hoisted(() => ({
  optional: vi.fn(),
  speak: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo", () => ({ requireOptionalNativeModule: native.optional }));
vi.mock("expo-speech", () => ({ speak: native.speak, stop: native.stop }));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  native.optional.mockReturnValue({});
  native.stop.mockResolvedValue(undefined);
});
// Keep native SDK global declarations out of the Node server typecheck.
const load = () =>
  vi.importActual<{
    speakVoicePrompt: (text: string, language: "ta" | "en") => Promise<boolean>;
    stopVoicePrompt: () => Promise<void>;
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
});
