import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  selectionAsync: vi.fn(),
  impactAsync: vi.fn(),
}));
vi.mock("expo-haptics", () => ({
  ...native,
  ImpactFeedbackStyle: { Light: "light" },
}));

beforeEach(() => vi.resetAllMocks());

describe("optional native feedback", () => {
  const load = () =>
    vi.importActual<{
      selectionFeedback: () => Promise<void>;
      recordingFeedback: () => Promise<void>;
    }>("../../mobile/services/haptics.ts");

  it("does not produce rejected promises when vibration is unavailable", async () => {
    native.selectionAsync.mockRejectedValue(
      new Error("Haptic.selectionAsync is not available on android"),
    );
    native.impactAsync.mockRejectedValue(
      new Error("Haptic.impactAsync is not available on android"),
    );
    const { selectionFeedback, recordingFeedback } = await load();
    await expect(selectionFeedback()).resolves.toBeUndefined();
    await expect(recordingFeedback()).resolves.toBeUndefined();
  });
  it("retains selection and recording vibration on supported devices", async () => {
    native.selectionAsync.mockResolvedValue(undefined);
    native.impactAsync.mockResolvedValue(undefined);
    const { selectionFeedback, recordingFeedback } = await load();
    await selectionFeedback();
    await recordingFeedback();
    expect(native.selectionAsync).toHaveBeenCalledOnce();
    expect(native.impactAsync).toHaveBeenCalledWith("light");
  });
});
