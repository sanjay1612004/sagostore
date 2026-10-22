import { create } from "zustand";
import * as SecureStore from "../services/device-storage";
type Preferences = {
  theme: "dark" | "light";
  language: "ta" | "en";
  set: (v: Partial<Pick<Preferences, "theme" | "language">>) => Promise<void>;
};
export const usePreferences = create<Preferences>((set, get) => ({
  theme: "dark",
  language: "ta",
  set: async (v) => {
    set(v);
    const { theme, language } = get();
    await SecureStore.setItemAsync(
      "tamiltrade.preferences",
      JSON.stringify({ theme, language }),
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
        });
    } catch {
      /* defaults remain usable */
    }
  }
}
