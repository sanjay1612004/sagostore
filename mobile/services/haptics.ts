import * as Haptics from "expo-haptics";

async function feedback(action: () => Promise<void>) {
  try {
    await action();
  } catch {
    // Vibration is optional and unavailable in some Expo Go runtimes.
  }
}

export const selectionFeedback = () => feedback(() => Haptics.selectionAsync());
export const recordingFeedback = () =>
  feedback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
