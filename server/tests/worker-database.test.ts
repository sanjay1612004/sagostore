import { describe, it, expect, vi } from "vitest";
import {
  workerDatabaseFailure,
  resetWorkerDatabaseConnection,
} from "../src/shared/worker-database.js";

describe("speech worker database recovery", () => {
  it.each([
    ["MongooseError", "Connection was force closed", "connection_closed"],
    [
      "MongooseError",
      "Operation `queuestates.updateOne()` buffering timed out after 10000ms",
      "buffer_timeout",
    ],
    [
      "MongooseError",
      "Connection operation buffering timed out after 10000ms",
      "buffer_timeout",
    ],
    [
      "MongoNotConnectedError",
      "Client must be connected before running operations",
      "connection_closed",
    ],
    ["MongoNetworkTimeoutError", "timed out", "connection_unavailable"],
    ["MongoServerSelectionError", "unavailable", "connection_unavailable"],
    [
      "MongoWaitQueueTimeoutError",
      "pool unavailable",
      "connection_unavailable",
    ],
    ["ValidationError", "Invalid field", "other"],
    ["Error", "ENOENT audio file", "other"],
    ["MongoServerError", "duplicate key", "other"],
  ])("classifies %s safely", (name, message, expected) => {
    const error = new Error(message);
    error.name = name;
    expect(workerDatabaseFailure(error)).toBe(expected);
  });
  it("closes normally so model operations can resume", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    await resetWorkerDatabaseConnection({ close });
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
  });
  it("does not hide a failed reset and falsely mark recovery complete", async () => {
    const close = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(resetWorkerDatabaseConnection({ close })).rejects.toThrow(
      "database unavailable",
    );
  });
});
