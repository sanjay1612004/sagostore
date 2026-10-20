import { describe, expect, it } from "vitest";
import { resolveApiUrl } from "../../mobile/services/api-url.js";

describe("development API discovery", () => {
  it.each([
    ["192.168.1.92:8081", "http://192.168.1.92:5000"],
    ["10.0.2.2:8081", "http://10.0.2.2:5000"],
    ["localhost:8081", "http://localhost:5000"],
    ["exp://172.20.10.2:8082", "http://172.20.10.2:5000"],
    ["[::1]:8081", "http://[::1]:5000"],
  ])(
    "uses the Expo host %s rather than an emulator-only address",
    (hostUri, url) => {
      expect(
        resolveApiUrl({
          configuredUrl: "auto",
          development: true,
          platform: "android",
          hostUri,
        }),
      ).toEqual({ url });
    },
  );
  it("uses the page host for a phone browser", () => {
    expect(
      resolveApiUrl({
        configuredUrl: "auto",
        development: true,
        platform: "web",
        browserHostname: "192.168.1.92",
      }).url,
    ).toBe("http://192.168.1.92:5000");
  });
  it("honors an explicitly configured deployed API", () => {
    expect(
      resolveApiUrl({
        configuredUrl: "https://api.example.com/",
        development: false,
        platform: "android",
        hostUri: "192.168.1.92:8081",
      }).url,
    ).toBe("https://api.example.com");
  });
  it("uses a fixed LAN API in a standalone preview APK without Metro metadata", () => {
    expect(
      resolveApiUrl({
        configuredUrl: "http://192.168.1.92:5000",
        development: false,
        platform: "android",
      }).url,
    ).toBe("http://192.168.1.92:5000");
  });
  it.each([
    undefined,
    "",
    "project.exp.direct:80",
    "0.0.0.0:8081",
    "192.168.999.1:8081",
  ])(
    "does not turn an unavailable or tunneled Metro host into an API: %s",
    (hostUri) => {
      const result = resolveApiUrl({
        configuredUrl: "auto",
        development: true,
        platform: "android",
        hostUri,
      });
      expect(result.url).toBe("");
      expect(result.error).toContain("Expo LAN");
    },
  );
  it("requires an explicit API for release builds", () => {
    const result = resolveApiUrl({
      configuredUrl: "auto",
      development: false,
      platform: "android",
      hostUri: "192.168.1.92:8081",
    });
    expect(result.url).toBe("");
    expect(result.error).toContain("deployed HTTPS API");
  });
  it.each(["file:///tmp/server", "not-a-url"])(
    "rejects invalid explicit API URLs: %s",
    (configuredUrl) => {
      expect(
        resolveApiUrl({ configuredUrl, development: true, platform: "android" })
          .url,
      ).toBe("");
    },
  );
});
