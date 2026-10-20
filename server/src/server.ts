import mongoose from "mongoose";
import { app, logger } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, ensureIndexes } from "./modules/models.js";
async function main() {
  await connectDatabase(env.MONGODB_URI);
  await ensureIndexes();
  const server = app.listen(env.PORT, env.API_HOST, () =>
    logger.info(
      { host: env.API_HOST, port: env.PORT },
      "Shri Sai Ganesh Stores API listening",
    ),
  );
  server.on("error", () => {
    logger.fatal(
      { code: "LISTEN_FAILED" },
      "API could not bind its configured port",
    );
    process.exitCode = 1;
    void mongoose.disconnect();
  });
  const shutdown = () => {
    server.close(() => {
      void mongoose.disconnect().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
main().catch(() => {
  logger.fatal(
    { code: "STARTUP_FAILED" },
    "Could not start API. Check database connectivity, configuration and indexes.",
  );
  void mongoose.disconnect();
  process.exitCode = 1;
});
