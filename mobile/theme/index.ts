import { usePreferences } from "../store/preferences";
const shared = {
  emerald: "#12B886",
  radius: 18,
};
export const dark = {
  ...shared,
  bg: "#0D1518",
  surface: "#172125",
  elevated: "#1E2B2F",
  text: "#EFF5F3",
  muted: "#A1B3AF",
  border: "#2A393D",
  accent: "#50E3B5",
  accentText: "#092C22",
  soft: "#19372F",
  success: "#6BE2BB",
  successSoft: "#19372F",
  blue: "#8EBBFF",
  blueSoft: "#213653",
  warning: "#FFD083",
  warningSoft: "#443722",
  danger: "#FFA2B1",
  dangerSoft: "#472B3A",
  violet: "#C3AEFF",
  violetSoft: "#352B50",
  shadow: "#000000",
};
export const light = {
  ...shared,
  bg: "#F4F7F6",
  surface: "#FFFFFF",
  elevated: "#EDF3F0",
  text: "#182D28",
  muted: "#586F66",
  border: "#DCE6E1",
  accent: "#087F5B",
  accentText: "#FFFFFF",
  soft: "#E0F3EA",
  success: "#087F65",
  successSoft: "#E0F7EF",
  blue: "#2865B8",
  blueSoft: "#E7F0FF",
  warning: "#91600A",
  warningSoft: "#FFF2D9",
  danger: "#B43857",
  dangerSoft: "#FDE9EF",
  violet: "#7651BC",
  violetSoft: "#F0E9FF",
  shadow: "#34365C",
};
export const useTheme = () =>
  usePreferences((s) => s.theme) === "dark" ? dark : light;
export const useCopy = () => {
  const ta = usePreferences((s) => s.language) === "ta";
  return (en: string, tamil: string) => (ta ? tamil : en);
};
