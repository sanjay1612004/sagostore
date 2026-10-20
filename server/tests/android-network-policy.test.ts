import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  getLanApiHost,
  releasePolicy,
} = require("../../mobile/plugins/with-lan-api.cjs");

describe("installed APK network policy", () => {
  it.each(["192.168.1.92", "10.0.0.5", "172.20.10.2"])(
    "permits local preview HTTP only for %s",
    (host) => {
      const selected = getLanApiHost(`http://${host}:5000`);
      const xml = releasePolicy(selected);
      expect(selected).toBe(host);
      expect(xml).toContain('<base-config cleartextTrafficPermitted="false"');
      expect(xml).toContain(
        `<domain includeSubdomains="false">${host}</domain>`,
      );
      expect(xml.match(/<domain /g)).toHaveLength(1);
    },
  );
  it("has no HTTP exception when using the deployed HTTPS API", () => {
    const xml = releasePolicy(getLanApiHost("https://api.example.com"));
    expect(xml).not.toContain("domain-config");
    expect(xml).not.toContain('cleartextTrafficPermitted="true"');
  });
  it.each([
    "http://api.example.com",
    "http://8.8.8.8",
    "file:///tmp/api",
    "http://192.168.999.1",
  ])("rejects a nonlocal or invalid plaintext API: %s", (value) => {
    expect(() => getLanApiHost(value)).toThrow();
  });
});
