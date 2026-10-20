// A vocabulary hint, not an instruction or an example transaction. Never seed amounts.
const vocabulary =
  "வாங்கினேன், விற்றேன், மூட்டை, கிலோ, ரூபாய், விலை, லாரி வாடகை, பாக்கி, GPay";

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
