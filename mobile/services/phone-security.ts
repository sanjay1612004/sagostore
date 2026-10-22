import { AppState, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useSession } from "../store/session";
import { STORE_NAME } from "../config/brand";

let prompt: Promise<boolean> | undefined;
export const isPhonePromptOpen = () => !!prompt;
export function lockPhoneOnAppState(state: string) {
  if (Platform.OS !== "web" && state !== "active" && !isPhonePromptOpen())
    useSession.setState({ phoneUnlocked: false });
}

export function unlockPhone(): Promise<boolean> {
  if (Platform.OS === "web")
    return Promise.reject(new Error("Use the mobile app for phone unlock."));
  if (prompt) return prompt;
  prompt = (async () => {
    // SECRET includes a screen-lock PIN/pattern even without biometric hardware.
    const security = await LocalAuthentication.getEnrolledLevelAsync();
    if (security < LocalAuthentication.SecurityLevel.SECRET)
      throw new Error(
        "Set a screen-lock PIN, password or pattern in your phone’s Settings, then try again.",
      );
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Unlock ${STORE_NAME}`,
      cancelLabel: "Cancel",
      fallbackLabel: "Use phone passcode",
      disableDeviceFallback: false,
    });
    if (!result.success) {
      if (["user_cancel", "app_cancel", "system_cancel"].includes(result.error))
        return false;
      throw new Error(
        "Your phone could not verify you. Try again using your fingerprint, face or screen-lock PIN.",
      );
    }
    if (AppState.currentState !== "active") return false;
    useSession.setState({ phoneUnlocked: true });
    return true;
  })().finally(() => {
    prompt = undefined;
  });
  return prompt;
}
