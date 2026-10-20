type SpeechSettings = {
  SPEECH_ENGINE: "server" | "cli" | "sarvam";
  SARVAM_API_KEY: string;
  VOICE_MAX_DURATION_SECONDS: number;
};

export function speechSettings(config: SpeechSettings) {
  const cloud = config.SPEECH_ENGINE === "sarvam";
  return {
    provider: cloud ? "sarvam" : "whisper",
    ready: !cloud || Boolean(config.SARVAM_API_KEY.trim()),
    label: cloud
      ? "TAMIL + ENGLISH · CLOUD SPEECH"
      : "TAMIL · LOCAL SPEECH ENGINE",
    maxDurationSeconds: cloud
      ? Math.min(config.VOICE_MAX_DURATION_SECONDS, 30)
      : config.VOICE_MAX_DURATION_SECONDS,
  };
}
