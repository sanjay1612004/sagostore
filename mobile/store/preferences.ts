import { Platform } from "react-native";
import { create } from "zustand";
import * as SecureStore from "../services/device-storage";
type Preferences = {
  theme: "dark" | "light";
  language: "ta" | "en";
  biometric: boolean;
  set: (
    v: Partial<Pick<Preferences, "theme" | "language" | "biometric">>,
  ) => Promise<void>;
};
export const usePreferences = create<Preferences>((set, get) => ({
  theme: "light",
  language: "ta",
  biometric: false,
  set: async (v) => {
    set(v);
    const { theme, language, biometric } = get();
    await SecureStore.setItemAsync(
      "tamiltrade.preferences",
      JSON.stringify({ theme, language, biometric }),
    );
  },
}));
export async function loadPreferences() {
  const saved = await SecureStore.getItemAsync("tamiltrade.preferences");
  if (saved) {
    try {
      const v = JSON.parse(saved);
      if (
        ["dark", "light"].includes(v.theme) &&
        ["ta", "en"].includes(v.language)
      )
        usePreferences.setState({
          theme: v.theme,
          language: v.language,
          biometric: Platform.OS !== "web" && v.biometric === true,
        });
    } catch {
      /* defaults remain usable */
    }
  }
}
