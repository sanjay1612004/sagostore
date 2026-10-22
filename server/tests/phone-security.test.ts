import { beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({
  level: vi.fn(),
  authenticate: vi.fn(),
  setState: vi.fn(),
  platform: { OS: "android" },
  app: { currentState: "active" },
}));
vi.mock("react-native", () => ({
  Platform: phone.platform,
  AppState: phone.app,
}));
vi.mock("expo-local-authentication", () => ({
  getEnrolledLevelAsync: phone.level,
  authenticateAsync: phone.authenticate,
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));
vi.mock("../../mobile/store/session", () => ({
  useSession: { setState: phone.setState },
}));
const load = () =>
  vi.importActual<{
    unlockPhone: () => Promise<boolean>;
    isPhonePromptOpen: () => boolean;
    lockPhoneOnAppState: (state: string) => void;
  }>("../../mobile/services/phone-security.ts");

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  phone.platform.OS = "android";
  phone.app.currentState = "active";
  phone.level.mockResolvedValue(1);
  phone.authenticate.mockResolvedValue({ success: true });
});

describe("phone screen-lock authentication", () => {
  it("locks as soon as a phone leaves the active app, including inactive state", async () => {
    const { lockPhoneOnAppState } = await load();
    lockPhoneOnAppState("inactive");
    lockPhoneOnAppState("background");
    expect(phone.setState).toHaveBeenCalledTimes(2);
    expect(phone.setState).toHaveBeenLastCalledWith({ phoneUnlocked: false });
    phone.setState.mockClear();
    lockPhoneOnAppState("active");
    expect(phone.setState).not.toHaveBeenCalled();
  });
  it("accepts a PIN-only phone without requiring biometric hardware", async () => {
    const { unlockPhone } = await load();
    expect(await unlockPhone()).toBe(true);
    expect(phone.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({
        disableDeviceFallback: false,
        fallbackLabel: "Use phone passcode",
      }),
    );
    expect(phone.setState).toHaveBeenCalledWith({ phoneUnlocked: true });
  });
  it("accepts enrolled face/fingerprint authentication", async () => {
    phone.level.mockResolvedValue(3);
    expect(await (await load()).unlockPhone()).toBe(true);
  });
  it("requires a phone screen lock and stays locked without one", async () => {
    phone.level.mockResolvedValue(0);
    await expect((await load()).unlockPhone()).rejects.toThrow(
      "Set a screen-lock PIN",
    );
    expect(phone.authenticate).not.toHaveBeenCalled();
    expect(phone.setState).not.toHaveBeenCalled();
  });
  it.each(["user_cancel", "app_cancel", "system_cancel"])(
    "keeps the business locked after %s",
    async (error) => {
      phone.authenticate.mockResolvedValue({ success: false, error });
      expect(await (await load()).unlockPhone()).toBe(false);
      expect(phone.setState).not.toHaveBeenCalled();
    },
  );
  it("keeps the business locked after verification fails, then allows retry", async () => {
    phone.authenticate.mockResolvedValueOnce({
      success: false,
      error: "lockout",
    });
    const service = await load();
    await expect(service.unlockPhone()).rejects.toThrow("could not verify");
    expect(service.isPhonePromptOpen()).toBe(false);
    expect(phone.setState).not.toHaveBeenCalled();
    expect(await service.unlockPhone()).toBe(true);
  });
  it("does not open a phone that went to the background during verification", async () => {
    phone.authenticate.mockImplementation(async () => {
      phone.app.currentState = "background";
      return { success: true };
    });
    expect(await (await load()).unlockPhone()).toBe(false);
    expect(phone.setState).not.toHaveBeenCalled();
  });
  it("shares a single OS prompt across simultaneous unlock attempts", async () => {
    let resolve!: (value: { success: boolean }) => void;
    phone.authenticate.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const service = await load();
    const first = service.unlockPhone();
    const second = service.unlockPhone();
    expect(first).toBe(second);
    expect(service.isPhonePromptOpen()).toBe(true);
    service.lockPhoneOnAppState("inactive");
    expect(phone.setState).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(phone.authenticate).toHaveBeenCalledTimes(1));
    resolve({ success: true });
    await expect(first).resolves.toBe(true);
    expect(service.isPhonePromptOpen()).toBe(false);
    expect(phone.setState).toHaveBeenCalledTimes(1);
  });
  it("never pretends that browser access supports a native phone prompt", async () => {
    phone.platform.OS = "web";
    await expect((await load()).unlockPhone()).rejects.toThrow("mobile app");
    expect(phone.authenticate).not.toHaveBeenCalled();
  });
});
