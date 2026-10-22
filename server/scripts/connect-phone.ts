import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { connectDatabase, ensureIndexes, User } from "../src/modules/models.js";
import { issueConnectionCode } from "../src/modules/auth.js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email)
  throw new Error(
    "Usage: npm run connect:phone -w server -- owner@example.com",
  );
await connectDatabase(env.MONGODB_URI);
try {
  await ensureIndexes();
  const user = await User.findOne({ email, active: true });
  if (!user) throw new Error("Active account not found");
  const { code } = await issueConnectionCode(user);
  process.stdout.write(
    `One-time phone connection code (expires in 10 minutes):\n${code}\nEnter it only on your own phone. It grants access to this business account.\n`,
  );
} finally {
  await mongoose.disconnect();
}
