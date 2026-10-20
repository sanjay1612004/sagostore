import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
await mkdir(new URL("server/assets/", root), { recursive: true });
for (const [from, to] of [
  [
    "node_modules/@expo-google-fonts/noto-sans-tamil/400Regular/NotoSansTamil_400Regular.ttf",
    "NotoSansTamil-Regular.ttf",
  ],
  [
    "node_modules/@expo-google-fonts/noto-sans-tamil/LICENSE_FONT",
    "NotoSansTamil-LICENSE.txt",
  ],
  [
    "node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf",
    "Inter-Regular.ttf",
  ],
  ["node_modules/@expo-google-fonts/inter/LICENSE_FONT", "Inter-LICENSE.txt"],
])
  await copyFile(new URL(from, root), new URL(`server/assets/${to}`, root));
console.log(
  `Licensed PDF fonts installed in ${fileURLToPath(new URL("server/assets/", root))}`,
);
