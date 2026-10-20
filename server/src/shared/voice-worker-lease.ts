import { QueueState } from "../modules/models.js";

export function publishVoiceWorkerHeartbeat(owner: string) {
  return QueueState.updateOne(
    { _id: "voice" },
    {
      $set: { heartbeatOwner: owner, heartbeatAt: new Date() },
    },
  ).maxTimeMS(5000);
}

export async function voiceWorkerStatus() {
  const state = await QueueState.findById("voice")
    .select("heartbeatAt")
    .lean()
    .maxTimeMS(5000);
  const lastSeenAt = state?.heartbeatAt;
  return {
    online: Boolean(lastSeenAt && Date.now() - lastSeenAt.getTime() < 20000),
    lastSeenAt: lastSeenAt ?? null,
  };
}

export function acquireVoiceWorkerLease(owner: string, durationMs: number) {
  return QueueState.findOneAndUpdate(
    {
      _id: "voice",
      $or: [
        { leaseOwner: owner },
        { leaseUntil: { $lt: new Date() } },
        { leaseUntil: null },
      ],
    },
    {
      $set: {
        leaseOwner: owner,
        leaseUntil: new Date(Date.now() + durationMs),
      },
    },
    { new: true },
  ).maxTimeMS(5000);
}
