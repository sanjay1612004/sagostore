import { describe, it, expect } from "vitest";
import { tamilSpeechForm, tamilSpeechPrompt } from "../src/shared/speech.js";

describe("Tamil Whisper request contract", () => {
  it("requests original-language transcription even if the server defaults to translation or auto detection", () => {
    const form = tamilSpeechForm(
      new Uint8Array([1, 2, 3]),
      tamilSpeechPrompt(["ரமேஷ்"]),
      5,
    );
    expect(
      Object.fromEntries([...form.entries()].filter(([key]) => key !== "file")),
    ).toMatchObject({
      language: "ta",
      translate: "false",
      detect_language: "false",
      beam_size: "5",
      temperature: "0.0",
    });
    expect(form.get("prompt")).toContain("ரமேஷ்");
  });
  it("keeps a long business vocabulary within the short prompt window", () => {
    const prompt = tamilSpeechPrompt([
      "ரமேஷ்",
      "ரமேஷ்",
      "ABC\nMill",
      "நீண்டபெயர்".repeat(100),
    ]);
    expect(Array.from(prompt).length).toBeLessThanOrEqual(300);
    expect(prompt.match(/ரமேஷ்/g)).toHaveLength(1);
    expect(prompt).not.toContain("\n");
    expect(prompt).not.toMatch(/\d/);
  });
});
