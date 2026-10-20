import type { Connection } from "mongoose";

// Inspect messages only to classify failures; never log them because a driver
// message can contain connection strings or credentials.
export function workerDatabaseFailure(error: unknown) {
  const name = error instanceof Error ? error.name : "UnknownError";
  const message = error instanceof Error ? error.message : "";
  if (
    /Connection was force closed|Client must be connected|MongoClient must be connected|Topology is closed|client is closed/i.test(
      message,
    ) ||
    /MongoNotConnected|MongoTopologyClosed|MongoClientClosed/.test(name)
  )
    return "connection_closed" as const;
  if (
    /buffering timed out|Connection operation buffering timed out/i.test(
      message,
    )
  )
    return "buffer_timeout" as const;
  if (/Network|ServerSelection|PoolCleared|WaitQueueTimeout/.test(name))
    return "connection_unavailable" as const;
  return "other" as const;
}

export async function resetWorkerDatabaseConnection(
  connection: Pick<Connection, "close">,
) {
  // force=true leaves Mongoose's existing models marked force-closed. A normal
  // close clears that state and permits these same models to work on reconnect.
  await connection.close(false);
}
