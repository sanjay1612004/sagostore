import { Platform } from "react-native";
import Constants from "expo-constants";
import * as SecureStore from "./device-storage";
import { uuid } from "expo";
import { QueryClient } from "@tanstack/react-query";
import { useSession, type Credentials } from "../store/session";
import { resolveApiUrl } from "./api-url";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
    mutations: { retry: 0 },
  },
});
const configuredApiUrl =
  Platform.OS === "web"
    ? (process.env.EXPO_PUBLIC_WEB_API_URL ?? process.env.EXPO_PUBLIC_API_URL)
    : process.env.EXPO_PUBLIC_API_URL;
const apiConfiguration = resolveApiUrl({
  configuredUrl: configuredApiUrl,
  development: __DEV__,
  platform: Platform.OS,
  hostUri: Constants.expoConfig?.hostUri,
  browserHostname:
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location?.hostname
      : undefined,
});
export const apiUrl = apiConfiguration.url;
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: { field: string; message: string }[] = [],
    public retryAfterMs = 0,
  ) {
    super(message);
  }
}
let refreshPromise: Promise<void> | null = null;
async function renew() {
  const stored = await SecureStore.getItemAsync("tamiltrade.session");
  if (!stored) throw new ApiError(401, "SESSION_EXPIRED", "Please sign in");
  const { refreshToken } = JSON.parse(stored) as { refreshToken: string };
  const response = await fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    if (response.status === 401) {
      queryClient.clear();
      await useSession.getState().clear();
    }
    throw new ApiError(
      response.status,
      "SESSION_EXPIRED",
      "Could not restore your session. Check your connection or sign in again.",
    );
  }
  await useSession
    .getState()
    .setCredentials((await response.json()) as Credentials);
}
export async function restoreSession() {
  if (!apiUrl)
    throw new ApiError(
      0,
      "CONFIGURATION",
      apiConfiguration.error ?? "Configure your business server address.",
    );
  if (await SecureStore.getItemAsync("tamiltrade.session")) {
    if (Platform.OS !== "web" && !useSession.getState().phoneUnlocked)
      throw new ApiError(401, "PHONE_LOCKED", "Unlock your phone to continue.");
    try {
      await renew();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
  } else useSession.setState({ ready: true });
}
export async function api<T>(
  endpoint: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  if (!apiUrl)
    throw new ApiError(
      0,
      "CONFIGURATION",
      apiConfiguration.error ?? "Configure your business server address.",
    );
  const token = useSession.getState().accessToken;
  const form = options.body instanceof FormData;
  const signal = options.signal ?? AbortSignal.timeout(30000);
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers: {
        ...(!form ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal,
    });
  } catch (cause) {
    if (signal.aborted)
      throw new ApiError(
        0,
        options.signal?.aborted ? "REQUEST_CANCELLED" : "REQUEST_TIMEOUT",
        options.signal?.aborted
          ? "The request was cancelled."
          : "The request timed out. Please try again.",
      );
    if (
      cause instanceof Error &&
      /Unsupported FormData(?:Part)? implementation/.test(cause.message)
    )
      throw new ApiError(
        0,
        "UPLOAD_ENCODING",
        "The recording could not be prepared for upload. Please record again.",
      );
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      __DEV__
        ? "Cannot reach your business server. Keep the API running and connect your phone and computer to the same Wi-Fi, then try again."
        : "Cannot reach your business server. Check your connection and make sure the server is running, then try again.",
    );
  }
  if (
    response.status === 401 &&
    retry &&
    ![
      "/auth/login",
      "/auth/register",
      "/auth/refresh",
      "/auth/recover",
      "/auth/phone/connect",
    ].includes(endpoint)
  ) {
    refreshPromise ??= renew().finally(() => {
      refreshPromise = null;
    });
    await refreshPromise;
    return api<T>(endpoint, options, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const retryAfter = response.headers.get("Retry-After");
    const retryAfterMs = retryAfter
      ? /^\d+(\.\d+)?$/.test(retryAfter)
        ? Number(retryAfter) * 1000
        : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0
      : 0;
    throw new ApiError(
      response.status,
      body.error?.code ?? "REQUEST_FAILED",
      body.error?.message ?? "Request failed. Try again.",
      body.error?.fields,
      retryAfterMs,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
export const post = <T>(endpoint: string, data: unknown, key?: string) =>
  api<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
    headers: key ? { "Idempotency-Key": key } : {},
  });
export const newKey = () => uuid.v4();
export const invalidateBusiness = () =>
  queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
export async function logout() {
  await post("/auth/logout", {});
  queryClient.clear();
  await useSession.getState().clear();
}
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
