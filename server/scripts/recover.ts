import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import {
  connectDatabase,
  User,
  Recovery,
  Audit,
} from "../src/modules/models.js";
import { hashToken } from "../src/modules/auth.js";
const email = process.argv[2]?.toLowerCase();
if (!email)
  throw new Error("Usage: npm run recover -w server -- owner@example.com");
await connectDatabase(env.MONGODB_URI);
try {
  const user = await User.findOne({ email, active: true });
  if (!user) throw new Error("Active account not found");
  const token = randomBytes(32).toString("hex");
  await Recovery.deleteMany({ userId: user._id });
  await Recovery.create({
    userId: user._id,
    hash: hashToken(token),
    expiresAt: new Date(Date.now() + 15 * 60000),
  });
  await Audit.create({
    businessId: user.businessId,
    userId: user._id,
    action: "ADMIN_RECOVERY_TOKEN_CREATED",
    entityId: user._id,
  });
  process.stdout.write(
    `One-time recovery token (expires in 15 minutes):\n${token}\nDeliver privately after verifying the account owner's identity. Do not put this token in logs or tickets.\n`,
  );
} finally {
  await mongoose.disconnect();
}
