import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { spawn, type ChildProcess } from "node:child_process";
import { readFile, access, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { Express } from "express";
const cloud = process.env.RUN_SARVAM_INTEGRATION === "1";
const enabled = process.env.RUN_SPEECH_INTEGRATION === "1" || cloud;
describe.skipIf(!enabled)("real speech recognition pipeline", () => {
  let replica: MongoMemoryReplSet,
    worker: ChildProcess,
    app: Express,
    token: string;
  let workerOutput = "";
  const fixture = path.resolve("../speech/whisper.cpp/samples/jfk.wav");
  beforeAll(async () => {
    if (!process.env.GROQ_API_KEY)
      throw new Error(
        "Set the server-side GROQ_API_KEY for transcript understanding in the full speech pipeline test",
      );
    if (cloud && !process.env.SARVAM_API_KEY)
      throw new Error(
        "Set the server-side SARVAM_API_KEY for the cloud smoke test",
      );
    await access(fixture);
    replica = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.24" },
    });
    Object.assign(process.env, {
      NODE_ENV: "test",
      MONGODB_URI: replica.getUri(),
      JWT_ACCESS_SECRET: "speech-access-".repeat(6),
      JWT_REFRESH_SECRET: "speech-refresh-".repeat(6),
      REGISTRATION_ENABLED: "true",
      LOG_LEVEL: "silent",
      VOICE_STORAGE_PATH: "/tmp/tamiltrade-speech-test-audio",
      SPEECH_ENGINE: cloud ? "sarvam" : "server",
    });
    const models = await import("../src/modules/models.js");
    await models.connectDatabase(process.env.MONGODB_URI!);
    await models.ensureIndexes();
    app = (await import("../src/app.js")).app;
    const login = await request(app).post("/auth/register").send({
      email: "speech-test@example.com",
      password: "Testing-password-123",
      name: "Speech Test",
      businessName: "Speech integration test",
    });
    expect(login.status, login.text).toBe(201);
    token = login.body.accessToken;
    worker = spawn(
      process.execPath,
      [
        path.resolve("../node_modules/tsx/dist/cli.mjs"),
        "src/workers/voice.ts",
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: "development" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    worker.stdout?.on("data", (d) => {
      workerOutput = (workerOutput + d.toString()).slice(-4000);
    });
    worker.stderr?.on("data", (d) => {
      workerOutput = (workerOutput + d.toString()).slice(-4000);
    });
  }, 180000);
  afterAll(async () => {
    if (worker?.exitCode === null) {
      worker.kill("SIGTERM");
      await Promise.race([
        new Promise<void>((resolve) => worker.once("exit", () => resolve())),
        delay(5000),
      ]);
      if (worker.exitCode === null) worker.kill("SIGKILL");
    }
    await mongoose.disconnect();
    await replica?.stop();
  }, 15000);
  it.skipIf(cloud)(
    "transcribes the upstream English smoke sample using the multilingual model",
    async () => {
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(await readFile(fixture))], {
          type: "audio/wav",
        }),
        "jfk.wav",
      );
      form.append("language", "en");
      form.append("response_format", "json");
      const response = await fetch("http://127.0.0.1:8080/inference", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(120000),
      });
      expect(response.status).toBe(200);
      const transcript = (await response.json()) as { text: string };
      expect(transcript.text.toLowerCase()).toContain("ask not");
    },
    150000,
  );
  it("processes a real uploaded WAV through FFmpeg, worker, Whisper, and parser without financial writes", async () => {
    const key = randomUUID();
    const upload = await request(app)
      .post("/api/voice/jobs")
      .set({ Authorization: `Bearer ${token}`, "Idempotency-Key": key })
      .attach("audio", fixture, { contentType: "audio/wav" });
    expect(upload.status, upload.text).toBe(202);
    let status = "queued";
    let final: { transcript?: string; result?: unknown; error?: string } = {};
    for (let i = 0; i < 120; i++) {
      const job = await request(app)
        .get("/api/voice/jobs/" + upload.body._id)
        .set({ Authorization: `Bearer ${token}` });
      status = job.body.status;
      final = job.body;
      if (["completed", "error", "cancelled"].includes(status)) break;
      await delay(1000);
    }
    expect(status, JSON.stringify(final) + workerOutput).toBe("completed");
    expect(final.transcript?.length).toBeGreaterThan(0);
    if (cloud) expect(final.transcript?.toLowerCase()).toContain("ask not");
    expect(final.result).toBeTruthy();
    const models = await import("../src/modules/models.js");
    expect(await models.Record.countDocuments()).toBe(0);
    const job = await models.VoiceJob.findById(upload.body._id).select("+path");
    expect(job?.path).toBeUndefined();
  }, 150000);
});
