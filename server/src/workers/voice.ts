import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import mongoose from "mongoose";
import pino from "pino";
import { env } from "../config/env.js";
import { AppError } from "../shared/errors.js";
import {
  VoiceJob,
  User,
  connectDatabase,
  ensureIndexes,
  type VoiceJobDoc,
  QueueState,
  Contact,
  Product,
} from "../modules/models.js";
import { understand } from "../modules/voice.js";
import { tamilSpeechForm, tamilSpeechPrompt } from "../shared/speech.js";
import { transcribeSarvam, SpeechRecognitionError } from "../modules/sarvam.js";
import { speechSettings } from "../shared/speech-settings.js";
import {
  acquireVoiceWorkerLease,
  publishVoiceWorkerHeartbeat,
} from "../shared/voice-worker-lease.js";
export function runProcess(
  binary: string,
  args: string[],
  timeout: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new Error("Speech processing timed out. Try a shorter recording."),
      );
    }, timeout);
    child.stdout.on("data", (data: Buffer) => {
      bytes += data.length;
      if (bytes > 2 * 1024 * 1024) {
        child.kill("SIGKILL");
        return;
      }
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr = (stderr + data.toString()).slice(-2000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(
            `Audio tool exited with code ${code}: ${stderr.slice(-150)}`,
          ),
        );
    });
  });
}
const log = pino({ level: env.LOG_LEVEL });
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function processJob(job: mongoose.HydratedDocument<VoiceJobDoc>) {
  if (!job) return;
  const wav = job.path + ".wav";
  const start = Date.now();
  let transcriptionMs = 0;
  let understandingMs = 0;
  try {
    const user = await User.findOne({
      _id: job.userId,
      businessId: job.businessId,
      active: true,
    });
    if (!user) throw new Error("Account is unavailable");
    const metadata = JSON.parse(
      await runProcess(
        env.FFPROBE_PATH,
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-show_entries",
          "stream=codec_type",
          "-of",
          "json",
          job.path,
        ],
        10000,
      ),
    ) as { format?: { duration?: string }; streams?: { codec_type: string }[] };
    const duration = Number(metadata.format?.duration);
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > speechSettings(env).maxDurationSeconds ||
      !metadata.streams?.some((s) => s.codec_type === "audio")
    )
      throw new Error(
        "Recording is invalid or exceeds the audio duration limit",
      );
    await runProcess(
      env.FFMPEG_PATH,
      [
        "-nostdin",
        "-v",
        "error",
        "-y",
        "-i",
        job.path,
        "-t",
        String(env.VOICE_MAX_DURATION_SECONDS),
        "-vn",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        wav,
      ],
      15000,
    );
    let prompt = "";
    if (env.SPEECH_ENGINE !== "sarvam") {
      const [contacts, products] = await Promise.all([
        Contact.find({ businessId: job.businessId })
          .select("name aliases")
          .sort({ updatedAt: -1 })
          .limit(30)
          .lean(),
        Product.find({ businessId: job.businessId })
          .select("name")
          .sort({ updatedAt: -1 })
          .limit(10)
          .lean(),
      ]);
      prompt = tamilSpeechPrompt([
        ...products.map((product) => product.name),
        ...contacts.flatMap((contact) => [
          contact.name,
          ...(contact.aliases ?? []),
        ]),
      ]);
    }
    let transcript: string;
    const transcriptionStartedAt = Date.now();
    if (env.SPEECH_ENGINE === "sarvam") {
      transcript = await transcribeSarvam(await readFile(wav), {
        apiKey: env.SARVAM_API_KEY,
        model: env.SARVAM_MODEL,
        timeoutMs: env.SPEECH_TIMEOUT_MS,
      });
    } else if (env.SPEECH_ENGINE === "server") {
      const form = tamilSpeechForm(
        await readFile(wav),
        prompt,
        env.SPEECH_BEAM_SIZE,
      );
      const response = await fetch(`${env.WHISPER_SERVER_URL}/inference`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(env.SPEECH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error("Speech server unavailable");
      const result = (await response.json()) as { text?: string };
      transcript = result.text?.trim() ?? "";
    } else
      transcript = (
        await runProcess(
          env.WHISPER_CLI_PATH,
          [
            "-m",
            env.SPEECH_MODEL_PATH,
            "-l",
            "ta",
            "-bs",
            String(env.SPEECH_BEAM_SIZE),
            "--prompt",
            prompt,
            "-t",
            String(env.SPEECH_THREADS),
            "-nt",
            "-np",
            "-f",
            wav,
          ],
          env.SPEECH_TIMEOUT_MS,
        )
      ).trim();
    transcriptionMs = Date.now() - transcriptionStartedAt;
    if (!transcript)
      throw new Error(
        "No speech was detected. Try again closer to the microphone",
      );
    const active = await VoiceJob.findOneAndUpdate(
      { _id: job._id, status: "transcribing" },
      { $set: { status: "understanding", transcript } },
    );
    if (!active) return;
    const understandingStartedAt = Date.now();
    const result = await understand(
      { businessId: String(job.businessId), userId: String(job.userId) },
      transcript,
    );
    understandingMs = Date.now() - understandingStartedAt;
    await VoiceJob.updateOne(
      { _id: job._id, status: "understanding" },
      { $set: { status: "completed", result } },
    );
    log.info(
      {
        jobId: String(job._id),
        durationMs: Date.now() - start,
        queueWaitMs: Math.max(0, start - job.createdAt.getTime()),
        transcriptionMs,
        understandingMs,
        rss: process.memoryUsage().rss,
      },
      "Voice job completed",
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const message =
      error instanceof SpeechRecognitionError || error instanceof AppError
        ? error.message
        : code === "ENOENT"
          ? env.SPEECH_ENGINE === "sarvam"
            ? "Audio tools are unavailable. Ask the owner to install FFmpeg and FFprobe."
            : "Speech engine is unavailable. Ask the owner to install FFmpeg and the Tamil Whisper model."
          : error instanceof Error &&
              /duration|No speech|timed out|Account/.test(error.message)
            ? error.message
            : "Speech processing failed. Try a shorter recording or type your command.";
    await VoiceJob.updateOne(
      { _id: job._id, status: { $nin: ["cancelled", "completed"] } },
      {
        $set: {
          status: "error",
          error: message,
          errorCode: code ?? "SPEECH_FAILED",
          ...(error instanceof AppError && error.retryAfterSeconds !== undefined
            ? { retryAt: new Date(Date.now() + error.retryAfterSeconds * 1000) }
            : {}),
        },
      },
    );
    log.warn(
      {
        jobId: String(job._id),
        code: code ?? "SPEECH_FAILED",
        ...(error instanceof AppError && "reason" in error
          ? { reason: error.reason }
          : {}),
      },
      "Voice job failed",
    );
  } finally {
    await Promise.all([
      rm(job.path, { force: true }),
      rm(wav, { force: true }),
    ]);
    await VoiceJob.updateOne(
      { _id: job._id },
      { $unset: { path: 1, leaseUntil: 1 } },
    );
  }
}
async function main() {
  // A half-open database socket must not leave the single worker waiting
  // forever while uploads continue to enter the queue.
  const databaseOptions = {
    socketTimeoutMS: 15000,
    waitQueueTimeoutMS: 10000,
  };
  await connectDatabase(env.MONGODB_URI, databaseOptions);
  await ensureIndexes();
  await mkdir(env.VOICE_STORAGE_PATH, { recursive: true });
  const leaseOwner = randomUUID();
  await publishVoiceWorkerHeartbeat(leaseOwner);
  let publishing = false;
  const heartbeat = setInterval(() => {
    if (publishing) return;
    publishing = true;
    void publishVoiceWorkerHeartbeat(leaseOwner)
      .catch(() =>
        log.warn(
          { code: "HEARTBEAT_FAILED" },
          "Speech worker heartbeat could not be updated",
        ),
      )
      .finally(() => {
        publishing = false;
      });
  }, 5000);
  log.info({ provider: speechSettings(env).provider }, "Voice worker ready");
  try {
    while (!stopping) {
      try {
        if (mongoose.connection.readyState !== 1)
          await connectDatabase(env.MONGODB_URI, databaseOptions);
        const gate = await acquireVoiceWorkerLease(
          leaseOwner,
          env.SPEECH_TIMEOUT_MS + 60000,
        );
        if (!gate) {
          await delay(1000);
          continue;
        }
        try {
          const stale = await VoiceJob.find({
            status: { $in: ["transcribing", "understanding"] },
            leaseUntil: { $lt: new Date() },
          }).select("+path");
          for (const job of stale) {
            if (job.path) {
              await rm(job.path, { force: true });
              await rm(job.path + ".wav", { force: true });
            }
            await VoiceJob.updateOne(
              {
                _id: job._id,
                status: { $in: ["transcribing", "understanding"] },
              },
              {
                $set: {
                  status: "error",
                  error: "Speech worker restarted. Please retry.",
                },
                $unset: { path: 1 },
              },
            );
          }
          const job = await VoiceJob.findOneAndUpdate(
            { status: "queued", expiresAt: { $gt: new Date() } },
            {
              $set: {
                status: "transcribing",
                leaseUntil: new Date(
                  Date.now() + env.SPEECH_TIMEOUT_MS + 60000,
                ),
              },
            },
            { sort: { createdAt: 1 }, new: true },
          ).select("+path");
          if (job) await processJob(job);
          else await delay(1000);
          // Remove abandoned uploads, including uploads whose database insert failed.
          for (const filename of await readdir(env.VOICE_STORAGE_PATH)) {
            const filepath = path.join(env.VOICE_STORAGE_PATH, filename);
            const info = await stat(filepath).catch(() => null);
            if (info && Date.now() - info.mtimeMs > 86400000)
              await rm(filepath, { force: true });
          }
        } finally {
          await QueueState.updateOne(
            { _id: "voice", leaseOwner },
            { $unset: { leaseOwner: 1, leaseUntil: 1 } },
          );
        }
      } catch (error) {
        const failureName =
          error instanceof Error ? error.name : "UnknownError";
        log.error(
          {
            code: "WORKER_LOOP_FAILED",
            failureName,
          },
          "Worker will retry after database or disk failure",
        );
        if (
          /Network|ServerSelection|PoolCleared|WaitQueueTimeout/.test(
            failureName,
          )
        ) {
          // Drop the stale pool before retrying. Only this worker process uses
          // this connection; the API has its own independent connection pool.
          await mongoose.connection.close(true).catch(() => undefined);
        }
        await delay(5000);
      }
    }
  } finally {
    clearInterval(heartbeat);
    await QueueState.updateOne(
      { _id: "voice", heartbeatOwner: leaseOwner },
      {
        $unset: { heartbeatOwner: 1, heartbeatAt: 1 },
      },
    )
      .maxTimeMS(5000)
      .catch(() => undefined);
  }
  await mongoose.disconnect();
}
if (process.env.NODE_ENV !== "test")
  main().catch(() => {
    log.fatal("Voice worker could not start");
    process.exitCode = 1;
  });
