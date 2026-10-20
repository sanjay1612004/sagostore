import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeSarvam } from "../src/modules/sarvam.js";
import { speechSettings } from "../src/shared/speech-settings.js";

const wav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
const options = {
  apiKey: "private-test-key",
  model: "saaras:v4" as const,
  timeoutMs: 10000,
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Sarvam Tamil-English transcription", () => {
  it("uses automatic language detection and codemix without translating or changing names and amounts", async () => {
    const transcript = "ரமேஷ் storeக்கு 50 bags வித்தேன். Per bag 3500 rupees.";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ transcript, language_code: "ta-IN" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await transcribeSarvam(wav, options)).toBe(transcript);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.sarvam.ai/speech-to-text");
    expect(request.headers).toEqual({ "api-subscription-key": options.apiKey });
    expect(request.redirect).toBe("error");
    const form = request.body as FormData;
    expect(
      Object.fromEntries([...form.entries()].filter(([key]) => key !== "file")),
    ).toEqual({
      model: "saaras:v4",
      mode: "codemix",
      language_code: "unknown",
    });
    const audio = form.get("file") as File;
    expect(audio.type).toBe("audio/wav");
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(wav);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not contact the provider without an API key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      transcribeSarvam(wav, { ...options, apiKey: " " }),
    ).rejects.toMatchObject({ code: "SPEECH_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("supplies saved store phrases and aliases without cutting the customer prefix from the result", async () => {
    const transcript = "Wow Storeக்கு 150 மூட்டை sell பண்ணேன். One bag 150.";
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ transcript }));
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await transcribeSarvam(wav, {
        ...options,
        keyterms: ["Wow Store", "வாவ் ஸ்டோர்", "Sago", "wow store"],
      }),
    ).toBe(transcript);
    const form = fetchMock.mock.calls[0]![1].body as FormData;
    expect(JSON.parse(String(form.get("keyterms")))).toEqual([
      "Wow Store",
      "வாவ் ஸ்டோர்",
      "Sago",
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("never fabricates a missing customer from vocabulary hints", async () => {
    const transcript = "150 மூட்டை sell பண்ணேன். One bag 150.";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ transcript })),
    );
    expect(
      await transcribeSarvam(wav, { ...options, keyterms: ["Wow Store"] }),
    ).toBe(transcript);
  });

  it("omits unsupported vocabulary hints for saaras v3", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ transcript: "hello" }));
    vi.stubGlobal("fetch", fetchMock);
    await transcribeSarvam(wav, {
      ...options,
      model: "saaras:v3",
      keyterms: ["Wow Store"],
    });
    expect((fetchMock.mock.calls[0]![1].body as FormData).has("keyterms")).toBe(
      false,
    );
  });

  it.each([
    [401, "SPEECH_AUTH"],
    [403, "SPEECH_AUTH"],
    [402, "SPEECH_CREDITS"],
    [429, "SPEECH_RATE_LIMIT"],
    [422, "SPEECH_AUDIO_REJECTED"],
    [503, "SPEECH_UNAVAILABLE"],
  ])(
    "safely explains HTTP %s and never retries billable requests automatically",
    async (status, code) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(`private-test-key: confidential provider body`, {
          status: Number(status),
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const error = await transcribeSarvam(wav, options).catch((e: Error) => e);
      expect(error).toMatchObject({ code });
      expect(String(error)).not.toContain("private-test-key");
      expect(String(error)).not.toContain("confidential");
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it.each([{}, { transcript: null }, { transcript: 123 }])(
    "rejects an invalid provider result: %j",
    async (result) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(result)));
      await expect(transcribeSarvam(wav, options)).rejects.toMatchObject({
        code: "SPEECH_INVALID_RESPONSE",
      });
    },
  );
  it("handles silence and empty transcripts explicitly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ transcript: "  " })),
    );
    await expect(transcribeSarvam(wav, options)).rejects.toMatchObject({
      code: "NO_SPEECH",
    });
  });
  it("reports a provider network failure without exposing its raw error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(new Error("private-test-key: connection detail")),
    );
    await expect(transcribeSarvam(wav, options)).rejects.toMatchObject({
      code: "SPEECH_UNAVAILABLE",
    });
  });
  it("distinguishes a timeout from a provider outage", async () => {
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("aborted")));
    await expect(transcribeSarvam(wav, options)).rejects.toMatchObject({
      code: "SPEECH_TIMEOUT",
    });
  });
});

describe("public speech settings", () => {
  it("caps cloud recordings at 30 seconds and never exposes credentials", () => {
    const settings = speechSettings({
      SPEECH_ENGINE: "sarvam",
      SARVAM_API_KEY: options.apiKey,
      VOICE_MAX_DURATION_SECONDS: 60,
    });
    expect(settings).toMatchObject({
      provider: "sarvam",
      ready: true,
      maxDurationSeconds: 30,
    });
    expect(JSON.stringify(settings)).not.toContain(options.apiKey);
  });
  it("reports unfinished cloud setup while keeping local mode independent of API keys", () => {
    expect(
      speechSettings({
        SPEECH_ENGINE: "sarvam",
        SARVAM_API_KEY: "",
        VOICE_MAX_DURATION_SECONDS: 30,
      }).ready,
    ).toBe(false);
    expect(
      speechSettings({
        SPEECH_ENGINE: "server",
        SARVAM_API_KEY: "",
        VOICE_MAX_DURATION_SECONDS: 30,
      }),
    ).toMatchObject({ provider: "whisper", ready: true });
  });
});
