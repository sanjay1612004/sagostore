import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fileState = vi.hoisted(() => ({
  exists: true,
  bytes: new Uint8Array([
    0, 0, 0, 16, 102, 116, 121, 112, 77, 52, 65, 32, 0, 0, 0, 0,
  ]),
  deleted: vi.fn(),
}));
vi.mock("expo-file-system", () => ({
  File: class {
    name = "recording.m4a";
    type = "audio/mp4";
    constructor(public uri: string) {}
    get exists() {
      return fileState.exists;
    }
    get size() {
      return fileState.bytes.length;
    }
    async bytes() {
      return fileState.bytes;
    }
    delete() {
      fileState.deleted();
      fileState.exists = false;
    }
  },
}));

type RecordingFiles = {
  appendRecording: (form: FormData, uri: string) => Promise<void>;
  removeRecording: (uri: string) => Promise<void>;
};
const recordings = () =>
  vi.importActual<RecordingFiles>("../../mobile/services/recording-files.ts");
const encoder = () =>
  vi.importActual<{
    convertFormDataAsync: (
      form: FormData,
      boundary?: string,
    ) => Promise<{ body: Uint8Array; boundary: string }>;
  }>("../../node_modules/expo/src/winter/fetch/convertFormData.ts");

beforeEach(() => {
  fileState.exists = true;
  fileState.deleted.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("native recording upload through the installed Expo multipart encoder", () => {
  async function nativeForm() {
    const { installFormDataPatch } = await vi.importActual<{
      installFormDataPatch: (form: typeof FormData) => typeof FormData;
    }>("../../node_modules/expo/src/winter/FormData.ts");
    class RNFormData {
      _parts: [string, unknown][] = [];
    }
    return new (installFormDataPatch(
      RNFormData as unknown as typeof FormData,
    ))();
  }

  it("reproduces the failure of URI-only parts in Expo SDK 58", async () => {
    const form = await nativeForm();
    form.append("audio", {
      uri: "file:///recording.m4a",
      name: "command.m4a",
      type: "audio/mp4",
    } as unknown as Blob);
    const { convertFormDataAsync } = await encoder();
    await expect(convertFormDataAsync(form)).rejects.toThrow(
      "Unsupported FormDataPart implementation",
    );
  });

  it("sends actual file bytes, an audio MIME type and a filename", async () => {
    const form = await nativeForm();
    const { appendRecording } = await recordings();
    await appendRecording(form, "file:///recording.m4a");
    const { convertFormDataAsync } = await encoder();
    const { body, boundary } = await convertFormDataAsync(form);
    const received = await new Response(new Uint8Array(body), {
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    }).formData();
    const audio = received.get("audio") as File;
    expect(audio.name).toBe("recording.m4a");
    expect(audio.type).toBe("audio/mp4");
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(fileState.bytes);
    expect(fileState.deleted).not.toHaveBeenCalled();
  });

  it("reports a missing recording before attempting an upload", async () => {
    fileState.exists = false;
    const { appendRecording } = await recordings();
    await expect(
      appendRecording(await nativeForm(), "file:///missing.m4a"),
    ).rejects.toThrow("Recording could not be read");
  });

  it("makes cleanup idempotent", async () => {
    const { removeRecording } = await recordings();
    await removeRecording("file:///recording.m4a");
    await removeRecording("file:///recording.m4a");
    expect(fileState.deleted).toHaveBeenCalledTimes(1);
  });

  it("keeps browser recordings on the Blob upload path", async () => {
    const web = await vi.importActual<RecordingFiles>(
      "../../mobile/services/recording-files.web.ts",
    );
    const uri = URL.createObjectURL(
      new Blob([fileState.bytes], { type: "audio/webm" }),
    );
    try {
      const form = new FormData();
      await web.appendRecording(form, uri);
      const audio = form.get("audio") as File;
      expect(audio.name).toBe("command.webm");
      expect(audio.type).toBe("audio/webm");
      expect(new Uint8Array(await audio.arrayBuffer())).toEqual(
        fileState.bytes,
      );
    } finally {
      await web.removeRecording(uri);
    }
  });
});
