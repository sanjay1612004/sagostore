type ApiUrlOptions = {
  configuredUrl?: string;
  development: boolean;
  platform: string;
  hostUri?: string | null;
  browserHostname?: string;
};

function isLocalHost(host: string) {
  if (host === "localhost" || host.endsWith(".local") || host === "[::1]")
    return true;
  if (/^\[(?:fd|fc|fe80:)/i.test(host)) return true;
  const octets = host.split(".").map(Number);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host) || octets.some((n) => n > 255))
    return false;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31) ||
    (octets[0] === 169 && octets[1] === 254)
  );
}

export function resolveApiUrl(options: ApiUrlOptions): {
  url: string;
  error?: string;
} {
  const configured = options.configuredUrl?.trim();
  if (configured && configured !== "auto") {
    try {
      const url = new URL(configured);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      return { url: configured.replace(/\/+$/, "") };
    } catch {
      return {
        url: "",
        error: "Set a valid HTTP or HTTPS API URL in mobile/.env.",
      };
    }
  }
  if (configured !== "auto")
    return { url: "", error: "Set EXPO_PUBLIC_API_URL in mobile/.env." };
  if (!options.development)
    return {
      url: "",
      error:
        "Set your deployed HTTPS API URL before building the app. Automatic API discovery is for local development.",
    };
  try {
    const host =
      options.platform === "web"
        ? options.browserHostname
        : new URL(
            options.hostUri?.includes("://")
              ? options.hostUri
              : `http://${options.hostUri ?? ""}`,
          ).hostname;
    if (!host || !isLocalHost(host)) throw new Error();
    return { url: `http://${host}:5000` };
  } catch {
    return {
      url: "",
      error:
        "Open the app using Expo LAN on the same Wi-Fi as your computer, or configure a reachable HTTPS API URL. An Expo tunnel does not expose the API.",
    };
  }
}
