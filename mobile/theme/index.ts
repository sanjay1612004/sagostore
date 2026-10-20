import { usePreferences } from "../store/preferences";
const shared = {
  emerald: "#12B886",
  radius: 22,
};
export const dark = {
  ...shared,
  bg: "#101114",
  surface: "#1E1F24",
  elevated: "#282B33",
  text: "#EAECF2",
  muted: "#B1B6C6",
  border: "#373B47",
  accent: "#A8BBFF",
  accentText: "#172341",
  soft: "#25304D",
  success: "#70DFC0",
  successSoft: "#193D3A",
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
  bg: "#F5F5FC",
  surface: "#FFFFFF",
  elevated: "#F0F1FA",
  text: "#252944",
  muted: "#606781",
  border: "#E4E6F1",
  accent: "#6551D9",
  accentText: "#FFFFFF",
  soft: "#EEE9FF",
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
