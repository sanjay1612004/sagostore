import { File } from "expo-file-system";
export async function removeRecording(uri: string) {
  const file = new File(uri);
  if (file.exists) file.delete();
}
export async function appendRecording(form: FormData, uri: string) {
  const file = new File(uri);
  if (!file.exists || file.size === 0)
    throw new Error("Recording could not be read. Please record again.");
  // Expo SDK 58 fetch serializes File bytes; the old RN { uri } part is unsupported.
  form.append("audio", file);
}
