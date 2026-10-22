import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  save: vi.fn(),
  platform: { OS: "android" },
}));
vi.mock("react-native", () => ({ Platform: fixture.platform }));
vi.mock("expo", () => ({ uuid: { v4: () => "fictional-id" } }));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { hostUri: "192.168.1.92:8081" } },
}));
vi.mock("../../mobile/services/device-storage", () => ({
  getItemAsync: async (key: string) => fixture.storage.get(key) ?? null,
  setItemAsync: fixture.save,
  deleteItemAsync: async (key: string) => {
    fixture.storage.delete(key);
  },
  sessionStorageOptions: { keychainAccessible: "this-device-only" },
}));
const credentials = {
  user: {
    id: "test-user",
    businessId: "test-business",
    name: "Test",
    email: "phone@example.com",
    role: "owner",
    permissions: [],
  },
  accessToken: "fictional-access",
  refreshToken: "fictional-refresh",
  phoneUnlock: true,
};
type State = {
  ready: boolean;
  phoneUnlocked: boolean;
  accessToken: string | null;
  user: typeof credentials.user | null;
  setCredentials: (data: typeof credentials) => Promise<void>;
  clear: () => Promise<void>;
};
async function load() {
  const { useSession } = await vi.importActual<{
    useSession: {
      getState: () => State;
      setState: (data: Partial<State>) => void;
    };
  }>("../../mobile/store/session.ts");
  const api = await vi.importActual<{
    restoreSession: () => Promise<void>;
    post: (endpoint: string, body: object) => Promise<unknown>;
    logout: () => Promise<void>;
    queryClient: {
      setQueryData: (key: string[], value: unknown) => void;
      getQueryData: (key: string[]) => unknown;
    };
  }>("../../mobile/services/api.ts");
  return { session: useSession, ...api };
}
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  fixture.storage.clear();
  fixture.platform.OS = "android";
  fixture.save.mockImplementation(async (key: string, value: string) => {
    fixture.storage.set(key, value);
  });
  vi.stubGlobal("__DEV__", true);
  vi.stubEnv("EXPO_PUBLIC_API_URL", "http://192.168.1.92:5000");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(credentials)));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("secure phone session lifecycle", () => {
  it("stores only refresh credentials in device-bound storage and never unlocks just because credentials exist", async () => {
    const { session } = await load();
    await session.getState().setCredentials(credentials);
    const stored = JSON.parse(fixture.storage.get("tamiltrade.session")!);
    expect(stored).toEqual({
      refreshToken: credentials.refreshToken,
      user: credentials.user,
      phoneUnlock: true,
    });
    expect(stored).not.toHaveProperty("accessToken");
    expect(session.getState().phoneUnlocked).toBe(false);
    expect(fixture.save).toHaveBeenCalledWith(
      "tamiltrade.session",
      expect.any(String),
      { keychainAccessible: "this-device-only" },
    );
  });
  it("does not renew a saved session before phone unlock", async () => {
    const { session, restoreSession } = await load();
    fixture.storage.set("tamiltrade.session", JSON.stringify(credentials));
    await expect(restoreSession()).rejects.toMatchObject({
      code: "PHONE_LOCKED",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(session.getState().user).toBeNull();
  });
  it("restores a linked phone after OS verification without an account password", async () => {
    const { session, restoreSession } = await load();
    fixture.storage.set("tamiltrade.session", JSON.stringify(credentials));
    session.setState({ phoneUnlocked: true });
    await restoreSession();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({
        body: JSON.stringify({ refreshToken: credentials.refreshToken }),
      }),
    );
    expect(session.getState()).toMatchObject({
      user: credentials.user,
      phoneUnlocked: true,
      ready: true,
    });
  });
  it("opens the connection screen state for a fresh phone without making an authentication request", async () => {
    const { session, restoreSession } = await load();
    await restoreSession();
    expect(session.getState()).toMatchObject({
      ready: true,
      user: null,
      phoneUnlocked: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("removes revoked credentials so they cannot restore access on the next unlock", async () => {
    const { session, restoreSession } = await load();
    fixture.storage.set("tamiltrade.session", JSON.stringify(credentials));
    session.setState({ phoneUnlocked: true });
    vi.mocked(fetch).mockResolvedValue(Response.json({}, { status: 401 }));
    await restoreSession();
    expect(fixture.storage.has("tamiltrade.session")).toBe(false);
    expect(session.getState()).toMatchObject({
      ready: true,
      user: null,
      accessToken: null,
      phoneUnlocked: false,
    });
  });
  it("keeps the phone connection during a network outage so retry does not need another code", async () => {
    const { session, restoreSession } = await load();
    fixture.storage.set("tamiltrade.session", JSON.stringify(credentials));
    session.setState({ phoneUnlocked: true });
    vi.mocked(fetch).mockRejectedValue(new Error("Offline"));
    await expect(restoreSession()).rejects.toThrow("Offline");
    expect(fixture.storage.has("tamiltrade.session")).toBe(true);
    expect(session.getState().user).toBeNull();
  });
  it("does not refresh or retry an invalid connection code", async () => {
    const { post } = await load();
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        {
          error: { code: "CONNECTION_INVALID", message: "Ask for a new code" },
        },
        { status: 401 },
      ),
    );
    await expect(
      post("/auth/phone/connect", { code: "invalid" }),
    ).rejects.toMatchObject({ code: "CONNECTION_INVALID" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("disconnects the server session and clears local credentials, cached records and the unlocked state", async () => {
    const { session, logout, queryClient } = await load();
    await session.getState().setCredentials(credentials);
    session.setState({ phoneUnlocked: true });
    queryClient.setQueryData(["records"], { private: true });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await logout();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.any(Object),
    );
    expect(fixture.storage.has("tamiltrade.session")).toBe(false);
    expect(queryClient.getQueryData(["records"])).toBeUndefined();
    expect(session.getState()).toMatchObject({
      user: null,
      accessToken: null,
      phoneUnlocked: false,
    });
  });
});
