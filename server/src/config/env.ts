import { z } from "zod";
const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(5000),
    API_HOST: z.enum(["127.0.0.1", "0.0.0.0", "::1"]).default("127.0.0.1"),
    MONGODB_URI: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(40),
    JWT_REFRESH_SECRET: z.string().min(40),
    REGISTRATION_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    APP_BASE_URL: z.url().default("http://localhost:5000"),
    CORS_ORIGINS: z.string().default(""),
    LOG_LEVEL: z.string().default("info"),
    VOICE_STORAGE_PATH: z.string().default("./data/audio"),
    VOICE_MAX_FILE_SIZE_MB: z.coerce.number().min(1).max(20).default(10),
    VOICE_MAX_DURATION_SECONDS: z.coerce.number().min(1).max(60).default(30),
    VOICE_QUEUE_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
    SPEECH_MODEL_PATH: z
      .string()
      .default("/opt/tamiltrade/models/ggml-base-q5_1.bin"),
    SPEECH_ENGINE: z.enum(["server", "cli", "sarvam"]).default("server"),
    SARVAM_API_KEY: z.string().trim().default(""),
    SARVAM_MODEL: z.enum(["saaras:v3", "saaras:v4"]).default("saaras:v4"),
    GROQ_API_KEY: z.string().trim().default(""),
    COMMAND_AI_MODEL: z
      .literal("qwen/qwen3.8-27b")
      .default("qwen/qwen3.8-27b"),
    COMMAND_AI_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(25000)
      .default(25000),
    WHISPER_SERVER_URL: z.url().default("http://127.0.0.1:8080"),
    WHISPER_CLI_PATH: z
      .string()
      .default("/opt/tamiltrade/whisper.cpp/build/bin/whisper-cli"),
    FFMPEG_PATH: z.string().default("ffmpeg"),
    FFPROBE_PATH: z.string().default("ffprobe"),
    SPEECH_THREADS: z.coerce.number().int().min(1).max(8).default(2),
    SPEECH_BEAM_SIZE: z.coerce.number().int().min(1).max(10).default(5),
    SPEECH_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(600000)
      .default(180000),
    PDF_FONT_PATH: z.string().default("./assets/NotoSansTamil-Regular.ttf"),
    PDF_LATIN_FONT_PATH: z.string().default("./assets/Inter-Regular.ttf"),
    INVOICE_STORAGE_PATH: z.string().default("./data/invoices"),
  })
  .superRefine((v, ctx) => {
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(
        new URL(v.WHISPER_SERVER_URL).hostname,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["WHISPER_SERVER_URL"],
        message: "Speech server must use loopback; audio stays on this host",
      });
    if (v.JWT_ACCESS_SECRET === v.JWT_REFRESH_SECRET)
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "Use distinct secrets",
      });
    if (v.NODE_ENV === "production") {
      if (v.API_HOST === "0.0.0.0")
        ctx.addIssue({
          code: "custom",
          path: ["API_HOST"],
          message:
            "Production API must bind to loopback behind the HTTPS proxy",
        });
      if (!v.MONGODB_URI.startsWith("mongodb+srv://"))
        ctx.addIssue({
          code: "custom",
          path: ["MONGODB_URI"],
          message: "Production requires MongoDB Atlas SRV URI",
        });
      if (!v.APP_BASE_URL.startsWith("https://"))
        ctx.addIssue({
          code: "custom",
          path: ["APP_BASE_URL"],
          message: "Production requires HTTPS",
        });
      if (
        v.JWT_ACCESS_SECRET.includes("REPLACE") ||
        v.JWT_REFRESH_SECRET.includes("REPLACE")
      )
        ctx.addIssue({ code: "custom", message: "Replace template secrets" });
    }
  });
export const env = schema.parse(process.env);
