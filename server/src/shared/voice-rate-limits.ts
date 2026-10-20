import { rateLimit } from "express-rate-limit";
import type { Request } from "express";

const isJobStatus = (req: Request) =>
  req.method === "GET" && /^\/jobs\/[a-f\d]{24}\/?$/i.test(req.path);

export function voiceRateLimits() {
  const common = {
    windowMs: 60000,
    standardHeaders: "draft-8" as const,
    legacyHeaders: false,
    message: {
      error: {
        code: "VOICE_RATE_LIMIT",
        message:
          "Too many speech requests. Please wait a minute before retrying.",
      },
    },
  };
  return [
    rateLimit({ ...common, limit: 20, skip: isJobStatus }),
    rateLimit({ ...common, limit: 120, skip: (req) => !isJobStatus(req) }),
  ];
}
