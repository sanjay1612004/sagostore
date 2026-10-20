import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { voiceRateLimits } from "../src/shared/voice-rate-limits.js";

const statusPath = "/api/voice/jobs/0123456789abcdef01234567";
function testApp() {
  const app = express();
  app.use("/api/voice", ...voiceRateLimits());
  app.use((_req, res) => res.json({ status: "queued" }));
  return app;
}

describe("voice request budgets", () => {
  it("allows a minute of polling without consuming the command budget", async () => {
    const app = testApp();
    for (let i = 0; i < 60; i++)
      expect((await request(app).get(statusPath)).status).toBe(200);
    for (let i = 0; i < 20; i++)
      expect((await request(app).post("/api/voice/text")).status).toBe(200);
    const blocked = await request(app).post("/api/voice/jobs");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("VOICE_RATE_LIMIT");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect((await request(app).get(statusPath)).status).toBe(200);
  });

  it("still limits excessive status polling independently", async () => {
    const app = testApp();
    for (let i = 0; i < 120; i++)
      expect((await request(app).get(statusPath)).status).toBe(200);
    expect((await request(app).get(statusPath)).status).toBe(429);
    expect((await request(app).post("/api/voice/text")).status).toBe(200);
  });

  it("keeps cancellation and invalid status paths in the command budget", async () => {
    const app = testApp();
    for (let i = 0; i < 20; i++)
      expect((await request(app).delete(statusPath)).status).toBe(200);
    expect((await request(app).get("/api/voice/jobs/invalid")).status).toBe(
      429,
    );
    expect((await request(app).get(statusPath)).status).toBe(200);
  });
});
