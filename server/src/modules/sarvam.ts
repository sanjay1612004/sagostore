import { z } from "zod";

export class SpeechRecognitionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "SpeechRecognitionError";
  }
}

export type SarvamOptions = {
  apiKey: string;
  model: "saaras:v3" | "saaras:v4";
  timeoutMs: number;
};

const resultSchema = z.object({ transcript: z.string().max(10000) });

export async function transcribeSarvam(
  wav: Uint8Array,
  options: SarvamOptions,
): Promise<string> {
  if (!options.apiKey.trim())
    throw new SpeechRecognitionError(
      "SPEECH_NOT_CONFIGURED",
      "Cloud speech is not configured yet. Ask the owner to finish speech setup, or type your command.",
    );

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(wav)], { type: "audio/wav" }),
    "command.wav",
  );
  form.append("model", options.model);
  form.append("mode", "codemix");
  form.append("language_code", "unknown");

  let response: Response;
  const signal = AbortSignal.timeout(options.timeoutMs);
  try {
    response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": options.apiKey.trim() },
      body: form,
      signal,
      redirect: "error",
    });
  } catch {
    throw new SpeechRecognitionError(
      signal.aborted ? "SPEECH_TIMEOUT" : "SPEECH_UNAVAILABLE",
      signal.aborted
        ? "Speech recognition timed out. Try a shorter recording or type your command."
        : "The speech service could not be reached. Try again shortly or type your command.",
    );
  }
  // Never publish provider response bodies: they can contain credentials, audio details or transcripts.
  if (response.status === 401 || response.status === 403)
    throw new SpeechRecognitionError(
      "SPEECH_AUTH",
      "The speech service rejected its credentials. Ask the owner to check the Sarvam API key.",
    );
  if (response.status === 402)
    throw new SpeechRecognitionError(
      "SPEECH_CREDITS",
      "Speech service credits are exhausted. Ask the owner to check the Sarvam account, or type your command.",
    );
  if (response.status === 429)
    throw new SpeechRecognitionError(
      "SPEECH_RATE_LIMIT",
      "The speech service has reached its usage limit. Wait a moment and try again, or type your command.",
    );
  if (
    response.status === 400 ||
    response.status === 413 ||
    response.status === 422
  )
    throw new SpeechRecognitionError(
      "SPEECH_AUDIO_REJECTED",
      "The speech service could not process this recording. Record a shorter command of at most 30 seconds.",
    );
  if (!response.ok)
    throw new SpeechRecognitionError(
      "SPEECH_UNAVAILABLE",
      "The speech service is temporarily unavailable. Try again shortly or type your command.",
    );

  const result = resultSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!result.success)
    throw new SpeechRecognitionError(
      "SPEECH_INVALID_RESPONSE",
      "The speech service returned an unreadable result. Please try again.",
    );
  const transcript = result.data.transcript.trim().normalize("NFC");
  if (!transcript)
    throw new SpeechRecognitionError(
      "NO_SPEECH",
      "No speech was detected. Try again closer to the microphone.",
    );
  return transcript;
}
