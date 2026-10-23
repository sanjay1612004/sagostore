import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("expo-crypto", () => {
  throw new Error("Cannot find native module 'ExpoCrypto'");
});
vi.mock("expo", () => ({ uuid: { v4: () => randomUUID() } }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { hostUri: "192.168.1.92:8081" } },
}));
vi.mock("../../mobile/services/device-storage", () => ({}));
vi.mock("../../mobile/store/session", () => ({
  useSession: { getState: () => ({ accessToken: null }) },
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("__DEV__", true);
  vi.stubEnv("EXPO_PUBLIC_API_URL", "http://192.168.1.92:5000");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("mobile API startup without ExpoCrypto", () => {
  it("loads a standalone Android bundle when window has no browser location", async () => {
    vi.stubGlobal("__DEV__", false);
    vi.stubGlobal("window", {});
    vi.stubEnv(
      "EXPO_PUBLIC_API_URL",
      "https://tamiltrade-132-226-103-170.sslip.io",
    );
    const { apiUrl } = await vi.importActual<{ apiUrl: string }>(
      "../../mobile/services/api.ts",
    );
    expect(apiUrl).toBe("https://tamiltrade-132-226-103-170.sslip.io");
  });
  it("loads the API and creates valid idempotency keys when the optional crypto module is absent", async () => {
    const { apiUrl, newKey } = await vi.importActual<{
      apiUrl: string;
      newKey: () => string;
    }>("../../mobile/services/api.ts");
    expect(apiUrl).toBe("http://192.168.1.92:5000");
    const first = newKey(),
      second = newKey();
    expect(z.uuid().safeParse(first).success).toBe(true);
    expect(z.uuid().safeParse(second).success).toBe(true);
    expect(first).not.toBe(second);
  });
  it("reports multipart serialization failures without blaming server connectivity", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new Error("Unsupported FormDataPart implementation"),
        ),
    );
    const { api } = await vi.importActual<{
      api: (endpoint: string, options: RequestInit) => Promise<unknown>;
    }>("../../mobile/services/api.ts");
    await expect(
      api("/api/voice/jobs", { method: "POST", body: new FormData() }),
    ).rejects.toMatchObject({ code: "UPLOAD_ENCODING" });
  });
});
