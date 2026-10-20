const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("expo/config-plugins");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");

const resourceName = "tamiltrade_network_security_config";

function getLanApiHost(value) {
  if (!value || value === "auto") return undefined;
  const url = new URL(value);
  if (url.protocol === "https:") return undefined;
  if (url.protocol !== "http:")
    throw new Error("The API URL must use HTTP or HTTPS.");
  const host = url.hostname;
  const parts = host.split(".").map(Number);
  const ipv4 =
    /^\d+\.\d+\.\d+\.\d+$/.test(host) && parts.every((n) => n <= 255);
  const local =
    host === "localhost" ||
    (ipv4 &&
      (parts[0] === 10 ||
        parts[0] === 127 ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)));
  if (!local)
    throw new Error(
      "Use HTTPS for a deployed API. HTTP is only supported for a local LAN preview APK.",
    );
  return host;
}

function releasePolicy(host) {
  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
${
  host
    ? `  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">${host}</domain>
  </domain-config>\n`
    : ""
}</network-security-config>
`;
}

function withLanApi(config) {
  const host = getLanApiHost(process.env.EXPO_PUBLIC_API_URL?.trim());
  config = withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      mod.modResults,
    );
    application.$["android:networkSecurityConfig"] = `@xml/${resourceName}`;
    return mod;
  });
  return withDangerousMod(config, [
    "android",
    async (mod) => {
      const sources = path.join(mod.modRequest.platformProjectRoot, "app/src");
      for (const variant of ["main", "debug"]) {
        const directory = path.join(sources, variant, "res/xml");
        await mkdir(directory, { recursive: true });
        await writeFile(
          path.join(directory, `${resourceName}.xml`),
          variant === "main"
            ? releasePolicy(host)
            : '<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n  <base-config cleartextTrafficPermitted="true" />\n</network-security-config>\n',
        );
      }
      return mod;
    },
  ]);
}

module.exports = withLanApi;
module.exports.getLanApiHost = getLanApiHost;
module.exports.releasePolicy = releasePolicy;
