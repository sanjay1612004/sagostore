export async function removeRecording(uri: string) {
  if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
}

export async function appendRecording(form: FormData, uri: string) {
  const response = await fetch(uri);
  if (!response.ok)
    throw new Error("Recording could not be read. Please record again.");
  const blob = await response.blob();
  form.append(
    "audio",
    blob,
    blob.type.includes("mp4") ? "command.m4a" : "command.webm",
  );
}
