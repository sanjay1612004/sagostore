import React, { useState, useEffect, useRef } from "react";
import {
  View,
  AppState,
  Linking,
  Platform,
  Pressable,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { recordingFeedback } from "../../services/haptics";
import {
  removeRecording,
  appendRecording,
} from "../../services/recording-files";
import {
  type TradeInput,
  type Draft,
  type TradeRecord,
  type VoiceCatalogAction,
  type StockSummary,
  rupees,
} from "@tamiltrade/shared";
import {
  Mic,
  ReceiptText,
  History,
  ArrowUp,
  Wallet,
  Package,
} from "lucide-react-native";
import {
  api,
  post,
  newKey,
  ApiError,
  queryClient,
  invalidateBusiness,
} from "../../services/api";
import {
  followUpSpeechText,
  speakVoicePrompt,
  stopVoicePrompt,
} from "../../services/voice-prompts";
import { usePreferences } from "../../store/preferences";
import { useComposer } from "../../store/composer";
import { useTheme, useCopy } from "../../theme";
import {
  Screen,
  T,
  Card,
  Row,
  Button,
  ErrorNotice,
  ConfirmationSheet,
} from "../../components/ui";
import { VoiceMicrophoneButton } from "../../components/voice-orb";
import { StockSummaryView } from "../../components/stock-summary";
import {
  stockQuantity,
  stockWeight,
  stockUnit,
  stockUnitWeight,
} from "../../services/stock-display";
type Result = {
  intent: string;
  input: Partial<TradeInput>;
  missing: string[];
  clarification: string[];
  candidates: { _id: string; name: string }[];
  canPreview: boolean;
  catalogAction?: VoiceCatalogAction;
  understanding?: {
    provider: "groq" | "gemini";
    model?: string;
    fallback?: boolean;
  };
  followUp?: {
    id: string;
    field: string;
    question: string;
    questionTamil: string;
    choices: { value: string; label: string; speechLabelTamil?: string }[];
  };
  summary?: {
    contactName?: string;
    productName?: string;
    sourceLabel?: string;
    unit?: string;
    weightGrams?: number;
  };
  answer?:
    | StockSummary
    | {
        text?: string;
        balance?: number;
        grossProfit?: number;
        netProfit?: number;
        saleId?: string;
        todaySales?: number;
        contactId?: string;
        contactName?: string;
        filteredKind?: string;
        records?: {
          _id: string;
          kind: string;
          date: string;
          productName?: string;
          quantity: number;
          unitPrice?: string;
          total: number;
          paid: number;
        }[];
      }
    | {
        items?: {
          availableQuantity: number;
          productName: string;
          delivery: string;
        }[];
      }
    | unknown[];
};
type Job = {
  _id: string;
  status:
    | "queued"
    | "transcribing"
    | "understanding"
    | "completed"
    | "error"
    | "cancelled";
  result?: Result;
  transcript?: string;
  error?: string;
  errorCode?: string;
  retryAt?: string;
  queue?: { workerOnline: boolean; waitedSeconds: number };
};
type SpeechSettings = {
  provider: "sarvam" | "whisper";
  ready: boolean;
  label: string;
  maxDurationSeconds: number;
  understanding: {
    provider: "groq";
    model: string;
    ready: boolean;
    fallback?: {
      provider: "gemini";
      model: string;
      enabled: boolean;
      ready: boolean;
    };
  };
  worker?: { online: boolean; lastSeenAt: string | null };
};
const states = {
  idle: "Ready when you are",
  recording: "Listening · tap to finish",
  uploading: "Uploading recording…",
  queued: "Preparing recording…",
  transcribing: "Transcribing…",
  understanding: "Preparing details…",
  completed: "Ready to review",
  error: "Something needs your attention",
  cancelled: "Recording cancelled",
};
function CatalogDetails({ action }: { action: VoiceCatalogAction }) {
  const c = useTheme();
  const input = action.input;
  const rows: [string, string][] = [["Name", input.name ?? ""]];
  if (action.kind === "product") {
    rows.push(
      ["Trading unit", input.unit ?? ""],
      ["Weight per unit", `${(input.weightGrams ?? 0) / 1000} kg`],
      ["Low stock alert", `${input.lowStockQuantity ?? 10} units`],
    );
    if (input.quantity !== undefined) {
      rows.push([
        "Stock to receive",
        stockQuantity(input.quantity, input.unit ?? "unit"),
      ]);
      if (input.weightGrams)
        rows.push([
          "Total stock weight",
          stockWeight(input.quantity, input.weightGrams),
        ]);
    }
    if (input.unitPrice !== undefined)
      rows.push([
        `Purchase price per ${stockUnit(input.unit ?? "unit")}`,
        `₹${input.unitPrice}`,
      ]);
    if (input.category) rows.push(["Category", input.category]);
  } else {
    if (input.phone) rows.push(["Phone", input.phone]);
    if (input.address) rows.push(["Address", input.address]);
    if (input.aliases?.length)
      rows.push(["Other names", input.aliases.join(", ")]);
    rows.push(
      ["Payment terms", `${input.paymentTermsDays ?? 30} days`],
      [
        "Credit limit",
        Number(input.creditLimit ?? "0") === 0
          ? "No enforced limit"
          : `₹${input.creditLimit}`,
      ],
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {rows.map(([label, value]) => (
        <Row key={label} style={{ alignItems: "flex-start" }}>
          <T size={13} color={c.muted}>
            {label}
          </T>
          <T size={13} weight="medium" style={{ flex: 1, textAlign: "right" }}>
            {value}
          </T>
        </Row>
      ))}
    </View>
  );
}
export default function Voice() {
  const c = useTheme(),
    copy = useCopy();
  const language = usePreferences((preferences) => preferences.language);
  const params = useLocalSearchParams<{
    create?: string;
    stockProductId?: string;
    request?: string;
  }>();
  const startedRequest = useRef<string | undefined>(undefined);
  const { width } = useWindowDimensions();
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const audio = useAudioRecorderState(recorder, 100);
  const [state, setState] = useState<keyof typeof states>("idle"),
    [text, setText] = useState(""),
    [error, setError] = useState<unknown>(),
    [result, setResult] = useState<Result | null>(null),
    [jobId, setJobId] = useState<string | null>(null),
    [levels, setLevels] = useState<number[]>([]),
    [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const commandInFlight = useRef(false);
  const lastSpokenQuestion = useRef<string | null>(null);
  const reviewKey = useRef({ body: "", key: newKey() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState<unknown>();
  const [savedRecord, setSavedRecord] = useState<TradeRecord | null>(null);
  const [catalogReview, setCatalogReview] = useState(false);
  const [savedCatalog, setSavedCatalog] = useState<{
    kind: VoiceCatalogAction["kind"];
    entityId: string;
    name: string;
  } | null>(null);
  const shownTranscriptJob = useRef<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [voicePromptUnavailable, setVoicePromptUnavailable] = useState(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const [retryClock, setRetryClock] = useState(Date.now());
  useEffect(() => {
    if (!retryUntil) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setRetryClock(now);
      if (now >= retryUntil) setRetryUntil(0);
    }, 250);
    return () => clearInterval(timer);
  }, [retryUntil]);
  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        void stopVoicePrompt();
        if (jobId)
          void queryClient.cancelQueries({ queryKey: ["voice-job", jobId] });
      };
    }, [jobId]),
  );
  const speakQuestion = () => {
    const action = result?.catalogAction;
    const question =
      result?.followUp ??
      (action?.kind === "supplier" && action.purchaseInput && action.ready
        ? {
            field: "supplierApproval",
            question: `${action.input.name} is a new supplier. Shall I add it to your supplier list?`,
            questionTamil: `${action.input.name} புதிய சப்ளையர். உங்கள் சப்ளையர் பட்டியலில் சேர்க்கலாமா?`,
            choices: [],
          }
        : undefined);
    if (!question) return;
    setVoicePromptUnavailable(false);
    void speakVoicePrompt(
      followUpSpeechText(question, language),
      language,
      () => setVoicePromptUnavailable(true),
    );
  };
  const spokenQuestionId =
    result?.followUp?.id ??
    (result?.catalogAction?.kind === "supplier" &&
    result.catalogAction.purchaseInput &&
    result.catalogAction.ready
      ? result.catalogAction.reviewId
      : undefined);
  useEffect(() => {
    if (
      !focused ||
      state !== "completed" ||
      !spokenQuestionId ||
      lastSpokenQuestion.current === spokenQuestionId
    )
      return;
    lastSpokenQuestion.current = spokenQuestionId;
    speakQuestion();
  }, [focused, state, spokenQuestionId, language]);
  const uploadRef = useRef<{ uri: string; key: string } | null>(null);
  const speech = useQuery({
    queryKey: ["voice-settings"],
    queryFn: () => api<SpeechSettings>("/api/voice/config"),
    enabled: focused,
    refetchInterval: focused ? 10000 : false,
  });
  const maxDurationSeconds = speech.data?.maxDurationSeconds ?? 30;
  const job = useQuery({
    queryKey: ["voice-job", jobId],
    queryFn: ({ signal }) => api<Job>(`/api/voice/jobs/${jobId}`, { signal }),
    enabled: !!jobId && focused,
    retry: (count, error) =>
      count < 3 &&
      error instanceof ApiError &&
      (error.status === 0 || error.status === 429 || error.status >= 500),
    retryDelay: (count, error) =>
      Math.max(
        Math.min(5000 * 2 ** count, 30000),
        error instanceof ApiError ? error.retryAfterMs : 0,
        error instanceof ApiError && error.status === 429 ? 60000 : 0,
      ),
    refetchInterval: (q) =>
      q.state.error ||
      (q.state.data &&
        ["completed", "error", "cancelled"].includes(q.state.data.status))
        ? false
        : q.state.data?.queue?.workerOnline === false
          ? 5000
          : 1000,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (job.error) setState("error");
  }, [job.error]);
  useEffect(() => {
    if (!job.data) return;
    setState(job.data.status);
    if (job.data.transcript && shownTranscriptJob.current !== job.data._id) {
      shownTranscriptJob.current = job.data._id;
      setText(job.data.transcript);
    }
    if (job.data.status === "completed") {
      setResult(job.data.result ?? null);
      uploadRef.current = null;
    } else if (job.data.status === "error") {
      if (job.data.errorCode === "AI_RATE_LIMIT") {
        const parsed = Date.parse(job.data.retryAt ?? "");
        const until = Number.isFinite(parsed) ? parsed : Date.now() + 60000;
        setRetryClock(Date.now());
        setRetryUntil(until);
        setError(
          new ApiError(
            429,
            "AI_RATE_LIMIT",
            job.data.error ??
              "The AI allowance is temporarily used up. Your transcript is kept.",
            undefined,
            Math.max(0, until - Date.now()),
          ),
        );
      } else setError(new Error(job.data.error));
    }
  }, [job.data]);
  useEffect(() => {
    if (audio.isRecording)
      setLevels((previous) => [
        ...previous.slice(-30),
        Math.max(0, Math.min(1, ((audio.metering ?? -60) + 60) / 60)),
      ]);
  }, [audio.metering, audio.isRecording]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") void stopVoicePrompt();
      if (s === "background" && recorder.isRecording) {
        void (async () => {
          try {
            await recorder.stop();
            await setAudioModeAsync({ allowsRecording: false });
            if (recorder.uri) await removeRecording(recorder.uri);
            setState("cancelled");
          } catch (e) {
            setError(e);
            setState("error");
          }
        })();
      }
    });
    return () => {
      sub.remove();
      if (recorder.isRecording)
        void recorder
          .stop()
          .then(() => setAudioModeAsync({ allowsRecording: false }))
          .catch(() => undefined);
    };
  }, [recorder]);
  const upload = async (uri: string, key: string) => {
    setBusy(true);
    setError(undefined);
    setState("uploading");
    try {
      const form = new FormData();
      await appendRecording(form, uri);
      const created = await api<Job>("/api/voice/jobs", {
        method: "POST",
        body: form,
        headers: { "Idempotency-Key": key },
      });
      setJobId(created._id);
      setState(created.status ?? "queued");
      uploadRef.current = null;
      // An accepted upload stays successful even if temporary-file cleanup fails.
      await removeRecording(uri).catch(() => undefined);
    } catch (e) {
      setError(e);
      setState("error");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  };
  const stop = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) throw new Error("Recording was not saved. Please try again.");
      const pending = { uri, key: newKey() };
      uploadRef.current = pending;
      await upload(pending.uri, pending.key);
    } catch (e) {
      setError(e);
      setState("error");
      submitting.current = false;
    }
  };
  useEffect(() => {
    if (audio.isRecording && audio.durationMillis >= maxDurationSeconds * 1000)
      void stop();
  }, [audio.durationMillis, audio.isRecording, maxDurationSeconds]);
  const record = async () => {
    if (!audio.isRecording && retryUntil > Date.now()) return;
    setError(undefined);
    if (audio.isRecording) {
      await stop();
      return;
    }
    try {
      await stopVoicePrompt();
      if (speech.data?.ready === false)
        throw new Error(
          "Cloud speech is not configured yet. Ask the owner to finish speech setup, or type your command.",
        );
      if (speech.data?.worker?.online === false)
        throw new Error(
          "Speech processing is offline. You can type your command while processing is restarted.",
        );
      if (uploadRef.current) {
        await removeRecording(uploadRef.current.uri).catch(() => undefined);
        uploadRef.current = null;
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Microphone access is needed to record. Enable it in your device settings or type a command below.",
        );
      setJobId(null);
      setResult((previous) => (previous?.followUp ? previous : null));
      setSavedRecord(null);
      setSavedCatalog(null);
      setLevels([]);
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState("recording");
      void recordingFeedback();
    } catch (e) {
      setError(e);
      setState("error");
    }
  };
  const cancel = async () => {
    try {
      if (audio.isRecording) {
        await recorder.stop();
        if (recorder.uri) await removeRecording(recorder.uri);
        await setAudioModeAsync({ allowsRecording: false });
      }
      if (jobId) await api(`/api/voice/jobs/${jobId}`, { method: "DELETE" });
      setJobId(null);
      setState("cancelled");
    } catch (e) {
      setError(e);
    }
  };
  const understand = async (command = text, contactId?: string) => {
    if (commandInFlight.current || retryUntil > Date.now()) return;
    commandInFlight.current = true;
    setRetryUntil(0);
    setBusy(true);
    setState("understanding");
    setError(undefined);
    setJobId(null);
    setResult((previous) => (previous?.followUp ? previous : null));
    setSavedRecord(null);
    setSavedCatalog(null);
    try {
      await stopVoicePrompt();
      setText(command);
      setResult(
        await post<Result>("/api/voice/text", { text: command, contactId }),
      );
      setState("completed");
    } catch (e) {
      setError(e);
      if (
        e instanceof ApiError &&
        e.code === "AI_RATE_LIMIT" &&
        e.status === 429
      ) {
        setRetryClock(Date.now());
        setRetryUntil(Date.now() + (e.retryAfterMs || 60000));
      }
      setState("error");
    } finally {
      commandInFlight.current = false;
      setBusy(false);
    }
  };
  const startOver = async () => {
    setBusy(true);
    await stopVoicePrompt();
    try {
      await api("/api/voice/context", { method: "DELETE" });
      setJobId(null);
      setResult(null);
      setText("");
      setError(undefined);
      setReviewError(undefined);
      setSavedCatalog(null);
      setState("idle");
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  const reviewTransaction = async () => {
    if (!result?.canPreview || reviewBusy) return;
    await stopVoicePrompt();
    setReviewBusy(true);
    setReviewError(undefined);
    const body = JSON.stringify(result.input);
    if (reviewKey.current.body !== body)
      reviewKey.current = { body, key: newKey() };
    try {
      setDraft(
        await post<Draft>("/api/drafts", result.input, reviewKey.current.key),
      );
    } catch (failure) {
      setReviewError(failure);
    } finally {
      setReviewBusy(false);
    }
  };
  const confirmTransaction = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setReviewError(undefined);
    try {
      const saved = await post<TradeRecord>(
        `/api/drafts/${draft._id}/confirm`,
        { confirm: true },
      );
      setSavedRecord(saved);
      setSavedCatalog(null);
      setJobId(null);
      setDraft(null);
      setResult(null);
      setText("");
      setState("idle");
      await invalidateBusiness();
    } catch (failure) {
      setReviewError(failure);
    } finally {
      setSaving(false);
    }
  };
  const confirmCatalog = async () => {
    if (!result?.catalogAction?.reviewId || !result.canPreview || saving)
      return;
    setSaving(true);
    setReviewError(undefined);
    try {
      const receipt = await post<{
        kind: VoiceCatalogAction["kind"];
        entityId: string;
        name: string;
        stockEntry?: Result;
        nextAction?: Result;
      }>("/api/voice/catalog/confirm", {
        confirm: true,
        reviewId: result.catalogAction.reviewId,
      });
      setCatalogReview(false);
      setJobId(null);
      const next = receipt.nextAction ?? receipt.stockEntry;
      setResult(next ?? null);
      setText("");
      setState(next ? "completed" : "idle");
      setSavedCatalog(next ? null : receipt);
      await invalidateBusiness();
    } catch (failure) {
      setReviewError(failure);
    } finally {
      setSaving(false);
    }
  };
  const processing =
    busy ||
    reviewBusy ||
    saving ||
    ["queued", "transcribing", "understanding"].includes(state);
  useEffect(() => {
    const stockRequest = params.create === "stock" && params.stockProductId;
    if (
      !focused ||
      !params.request ||
      startedRequest.current === params.request ||
      (!stockRequest &&
        !["customer", "supplier", "product"].includes(params.create ?? ""))
    )
      return;
    if (processing || audio.isRecording) return;
    startedRequest.current = params.request;
    commandInFlight.current = true;
    setBusy(true);
    setState("understanding");
    setError(undefined);
    setJobId(null);
    setText("");
    setResult(null);
    setDraft(null);
    setCatalogReview(false);
    setReviewError(undefined);
    setSavedRecord(null);
    setSavedCatalog(null);
    void stopVoicePrompt()
      .then(() =>
        post<Result>(
          stockRequest ? "/api/voice/stock/start" : "/api/voice/catalog/start",
          stockRequest
            ? { productId: params.stockProductId }
            : { kind: params.create },
        ),
      )
      .then((response) => {
        setResult(response);
        setState("completed");
      })
      .catch((failure) => {
        setError(failure);
        setState("error");
      })
      .finally(() => {
        commandInFlight.current = false;
        setBusy(false);
      });
  }, [
    focused,
    params.request,
    params.create,
    params.stockProductId,
    processing,
    audio.isRecording,
  ]);
  const coolingDown = retryUntil > retryClock;
  const canRetryTranscript =
    job.data?.status === "error" && Boolean(job.data.transcript?.trim());
  const answer = result?.answer;
  const composer = (
    <View>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: composerFocused ? c.accent : c.border,
          backgroundColor: c.surface,
          padding: width < 360 ? 14 : 18,
          gap: 16,
        }}
      >
        <TextInput
          accessibilityLabel="Your command / transcript"
          multiline
          numberOfLines={2}
          editable={!processing && !audio.isRecording}
          onFocus={() => setComposerFocused(true)}
          onBlur={() => setComposerFocused(false)}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setResult((previous) => (previous?.followUp ? previous : null));
            setSavedRecord(null);
            setSavedCatalog(null);
          }}
          placeholder={
            result?.followUp
              ? "Speak or type your reply…"
              : "Describe a transaction or ask a question…"
          }
          placeholderTextColor={c.muted}
          style={{
            color: c.text,
            fontFamily: "Inter",
            fontSize: 16,
            lineHeight: 24,
            minHeight: 64,
            maxHeight: 140,
            borderWidth: 0,
            borderColor: "transparent",
            outlineWidth: 0,
            outlineStyle: "solid",
            outlineColor: "transparent",
            boxShadow: "none",
            backgroundColor: "transparent",
            padding: 0,
            textAlignVertical: "top",
            ...(Platform.OS === "web"
              ? { scrollbarWidth: "none" as const }
              : {}),
          }}
        />
        <Row>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              flex: 1,
            }}
          >
            <T size={width < 360 ? 10 : 11} color={c.muted}>
              Tamil · Tanglish · English
            </T>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Understand command"
            accessibilityState={{
              disabled:
                audio.isRecording || processing || coolingDown || !text.trim(),
              busy,
            }}
            disabled={
              audio.isRecording || processing || coolingDown || !text.trim()
            }
            onPress={() => void understand()}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: c.accent,
              alignItems: "center",
              justifyContent: "center",
              opacity:
                audio.isRecording || processing || coolingDown || !text.trim()
                  ? 0.45
                  : pressed
                    ? 0.75
                    : 1,
            })}
          >
            {busy ? (
              <ActivityIndicator color={c.accentText} size="small" />
            ) : (
              <ArrowUp size={23} color={c.accentText} />
            )}
          </Pressable>
        </Row>
      </View>
    </View>
  );
  return (
    <Screen
      footer={composer}
      maxWidth={800}
      title={copy("Voice", "குரல் பதிவு")}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="History"
          onPress={() => router.push("/voice-history")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            paddingHorizontal: 14,
            paddingVertical: 10,
            minHeight: 44,
            borderRadius: 10,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <History size={15} color={c.muted} />
          <T size={12} weight="medium">
            History
          </T>
        </Pressable>
      }
    >
      <View
        style={{
          alignItems: "center",
          gap: 10,
          paddingTop: 12,
          paddingBottom: 8,
        }}
      >
        <VoiceMicrophoneButton
          compact
          recording={audio.isRecording}
          busy={processing}
          disabled={coolingDown}
          onPress={() => void record()}
          levels={levels}
        />
        <T
          size={13}
          color={c.muted}
          accessibilityLiveRegion="polite"
          style={{ textAlign: "center" }}
        >
          {job.isFetching &&
          job.failureReason instanceof ApiError &&
          job.failureReason.status === 429
            ? "Waiting before checking your recording again…"
            : state === "idle"
              ? copy("Tap to record", "பதிவு செய்யத் தொடுங்கள்")
              : state === "queued" && job.data?.queue?.workerOnline === false
                ? "Speech processing is offline · recording safely queued"
                : state === "queued" &&
                    (job.data?.queue?.waitedSeconds ?? 0) >= 20
                  ? "Speech processing is busy · your recording is queued"
                  : state === "completed"
                    ? result?.followUp
                      ? "Reply below"
                      : result?.intent.startsWith("GET_")
                        ? copy("Answer ready", "பதில் தயார்")
                        : states.completed
                    : states[state]}
        </T>
        {result?.understanding?.fallback && state === "completed" && (
          <T size={12} color={c.muted} accessibilityLiveRegion="polite">
            Understood with Gemini · primary AI usage limit reached
          </T>
        )}
        {audio.isRecording && (
          <T size={12} color={c.muted}>
            {Math.floor(audio.durationMillis / 1000)} / {maxDurationSeconds}{" "}
            seconds
          </T>
        )}
      </View>
      {state === "queued" && job.data?.queue?.workerOnline === false && (
        <Card>
          <T weight="bold">Speech processing is unavailable</T>
          <T color={c.muted}>
            Your uploaded recording is kept and will continue when processing
            returns. You can cancel it and type your command instead.
          </T>
        </Card>
      )}
      {(audio.isRecording ||
        busy ||
        ["queued", "transcribing", "understanding"].includes(state)) && (
        <Button
          title="Cancel"
          variant="secondary"
          disabled={busy}
          onPress={() => void cancel()}
        />
      )}
      <ErrorNotice
        error={error ?? job.error ?? job.failureReason}
        retryDisabled={busy || coolingDown}
        retryLabel={
          retryUntil > retryClock
            ? `Try again in ${Math.ceil((retryUntil - retryClock) / 1000)}s`
            : canRetryTranscript
              ? "Retry command"
              : "Try again"
        }
        retry={
          uploadRef.current
            ? () => {
                const pending = uploadRef.current!;
                void upload(pending.uri, pending.key);
              }
            : job.error
              ? () => {
                  setState(job.data?.status ?? "queued");
                  void job.refetch();
                }
              : (error instanceof ApiError || canRetryTranscript) && text.trim()
                ? () => void understand(text)
                : undefined
        }
      />
      {error instanceof Error && error.message.includes("Microphone") && (
        <Button
          title="Open device settings"
          variant="secondary"
          onPress={() => void Linking.openSettings()}
        />
      )}
      {result?.followUp && (
        <Card>
          <T size={12} color={c.accent}>
            One more detail
          </T>
          <T size={19} weight="medium" accessibilityLiveRegion="polite">
            {copy(result.followUp.question, result.followUp.questionTamil)}
          </T>
          {result.catalogAction?.input.name && (
            <T size={12} color={c.muted}>
              New {result.catalogAction.kind} ·{" "}
              {result.catalogAction.input.name}
            </T>
          )}
          {result.catalogAction?.kind === "product" &&
            result.catalogAction.input.unitPrice !== undefined && (
              <T size={12} color={c.muted}>
                {result.catalogAction.input.quantity !== undefined
                  ? `${stockQuantity(result.catalogAction.input.quantity, result.catalogAction.input.unit ?? "unit")} · `
                  : ""}
                ₹{result.catalogAction.input.unitPrice} per{" "}
                {stockUnit(result.catalogAction.input.unit ?? "unit")}
              </T>
            )}
          {voicePromptUnavailable && (
            <T size={12} color={c.muted} accessibilityLiveRegion="polite">
              Voice playback is unavailable. For Tamil, enable or download a
              Tamil voice in your device’s text-to-speech settings, then tap
              Repeat question. You can still reply below.
            </T>
          )}
          {(result.summary?.contactName || result.input.quantity) && (
            <T color={c.muted} size={12}>
              {[
                result.summary?.contactName,
                result.summary?.productName,
                result.input.quantity
                  ? stockQuantity(
                      result.input.quantity,
                      result.summary?.unit ?? "unit",
                    )
                  : undefined,
                result.summary?.weightGrams && result.summary?.unit
                  ? stockUnitWeight(
                      result.summary.weightGrams,
                      result.summary.unit,
                    )
                  : undefined,
                result.input.unitPrice
                  ? `₹${result.input.unitPrice}/${stockUnit(result.summary?.unit ?? "unit")}`
                  : undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
            </T>
          )}
          {result.followUp.choices.map((choice, index) => (
            <Pressable
              key={choice.value}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${choice.label}`}
              disabled={processing || coolingDown || audio.isRecording}
              onPress={() =>
                void understand(
                  result.followUp?.field === "sourceId"
                    ? `option ${choice.value}`
                    : choice.label,
                )
              }
              style={({ pressed }) => ({
                padding: 12,
                minHeight: 44,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: pressed ? c.soft : c.bg,
                opacity:
                  processing || coolingDown || audio.isRecording ? 0.5 : 1,
              })}
            >
              <T size={13}>
                {result.followUp?.field === "sourceId"
                  ? choice.value
                  : index + 1}
                . {choice.label}
              </T>
            </Pressable>
          ))}
          <Button
            title={audio.isRecording ? "Finish reply" : "Reply by voice"}
            disabled={processing || coolingDown}
            onPress={() => void record()}
          />
          <Row style={{ flexWrap: "wrap", justifyContent: "center" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hear the question again"
              disabled={processing || audio.isRecording}
              onPress={speakQuestion}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <T size={12} color={c.muted}>
                Repeat question
              </T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start over"
              disabled={processing || audio.isRecording}
              onPress={() => void startOver()}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <T size={12} color={c.muted}>
                Start over
              </T>
            </Pressable>
          </Row>
        </Card>
      )}
      {result?.catalogAction && !result.followUp && (
        <Card>
          <T size={19} weight="bold">
            New {result.catalogAction.kind}
          </T>
          <CatalogDetails action={result.catalogAction} />
          {result.catalogAction.kind === "supplier" &&
            result.catalogAction.purchaseInput && (
              <T accessibilityLiveRegion="polite">
                {copy(
                  `${result.catalogAction.input.name} is a new supplier. Shall I add it to your supplier list?`,
                  `${result.catalogAction.input.name} புதிய சப்ளையர். உங்கள் சப்ளையர் பட்டியலில் சேர்க்கலாமா?`,
                )}
              </T>
            )}
          <Button
            title={
              result.catalogAction.kind === "supplier" &&
              result.catalogAction.purchaseInput
                ? "Yes, add supplier"
                : `Review ${result.catalogAction.kind}`
            }
            disabled={processing || audio.isRecording || !result.canPreview}
            onPress={() => {
              void stopVoicePrompt();
              setReviewError(undefined);
              if (
                result.catalogAction?.kind === "supplier" &&
                result.catalogAction.purchaseInput
              )
                void confirmCatalog();
              else setCatalogReview(true);
            }}
          />
          <Button
            title={
              result.catalogAction.kind === "supplier" &&
              result.catalogAction.purchaseInput
                ? "No, cancel purchase"
                : "Start over"
            }
            variant="secondary"
            disabled={processing || audio.isRecording}
            onPress={() => void startOver()}
          />
          <ErrorNotice error={reviewError} />
        </Card>
      )}
      {result && !result.followUp && !result.catalogAction && (
        <Card>
          <Row>
            {result.intent === "GET_STOCK" ? (
              <Package color={c.muted} size={18} />
            ) : (
              <ReceiptText color={c.muted} size={18} />
            )}
            <T weight="bold">
              {result.followUp
                ? "One more detail"
                : result.intent === "UNKNOWN"
                  ? "Let’s clarify"
                  : result.intent === "GET_TRANSACTION_DETAILS"
                    ? answer
                      ? "Saved transaction details"
                      : "Choose the account"
                    : result.intent === "GET_STOCK"
                      ? copy("Current stock", "தற்போதைய இருப்பு")
                      : "Transaction details"}
            </T>
          </Row>
          {!result.followUp &&
            result.clarification.map((message, i) => (
              <T key={i} color={c.warning}>
                {message}
              </T>
            ))}
          {!result.followUp && result.candidates.length > 0 && (
            <T color={c.muted}>
              Possible accounts:{" "}
              {result.candidates.map((p) => p.name).join(", ")}
            </T>
          )}
          {result.intent === "GET_TRANSACTION_DETAILS" &&
            result.candidates.map((account) => (
              <Button
                key={account._id}
                title={`Look up ${account.name}`}
                variant="secondary"
                busy={busy}
                disabled={coolingDown || processing}
                onPress={() => void understand(text, account._id)}
              />
            ))}
          {!!result.input.kind && (
            <>
              <T size={18}>{result.input.kind.replaceAll("_", " ")}</T>
              {(result.summary?.contactName || result.summary?.productName) && (
                <T color={c.muted}>
                  {[result.summary.contactName, result.summary.productName]
                    .filter(Boolean)
                    .join(" · ")}
                </T>
              )}
              {typeof result.input.quantity === "number" && (
                <T>
                  {stockQuantity(
                    result.input.quantity,
                    result.summary?.unit ?? "unit",
                  )}{" "}
                  · ₹{result.input.unitPrice ?? "price needed"}/
                  {stockUnit(result.summary?.unit ?? "unit")}
                </T>
              )}
              {!!result.summary?.weightGrams && !!result.summary.unit && (
                <T color={c.muted} size={12}>
                  {stockUnitWeight(
                    result.summary.weightGrams,
                    result.summary.unit,
                  )}
                  {result.input.quantity
                    ? ` · ${stockWeight(result.input.quantity, result.summary.weightGrams)} total`
                    : ""}
                </T>
              )}
              {!!result.input.amount && <T>Amount: ₹{result.input.amount}</T>}
              {result.canPreview && (
                <Button
                  title="Review & save"
                  busy={reviewBusy}
                  disabled={processing || audio.isRecording}
                  onPress={() => void reviewTransaction()}
                />
              )}
              {!draft && <ErrorNotice error={reviewError} />}
              <Row
                style={{ justifyContent: "center", flexWrap: "wrap", gap: 24 }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit manually"
                  disabled={processing || audio.isRecording}
                  onPress={() => {
                    void stopVoicePrompt();
                    useComposer.getState().set(result.input);
                    router.push("/trade");
                  }}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <T size={13} color={c.muted}>
                    Edit details
                  </T>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Start over"
                  disabled={processing || audio.isRecording}
                  onPress={() => void startOver()}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <T size={13} color={c.muted}>
                    Start over
                  </T>
                </Pressable>
              </Row>
            </>
          )}
          {answer &&
            !Array.isArray(answer) &&
            "text" in answer &&
            !!answer.text && (
              <T size={19} color={c.accent}>
                {answer.text}
              </T>
            )}
          {answer &&
            !Array.isArray(answer) &&
            "netProfit" in answer &&
            typeof answer.netProfit === "number" && (
              <>
                <T>Current month net profit: {rupees(answer.netProfit)}</T>
                <T color={c.muted} size={12}>
                  Specific lot cost, inclusive tax. Operating expenses recorded
                  separately are deducted.
                </T>
              </>
            )}
          {answer &&
            !Array.isArray(answer) &&
            "todaySales" in answer &&
            typeof answer.todaySales === "number" && (
              <T>Today’s sales: {rupees(answer.todaySales)}</T>
            )}
          {answer &&
            !Array.isArray(answer) &&
            "type" in answer &&
            answer.type === "stock_summary" && (
              <StockSummaryView summary={answer} />
            )}
          {answer &&
            !Array.isArray(answer) &&
            "items" in answer &&
            answer.items?.map((lot, i) => (
              <T key={i}>
                {lot.productName}: {lot.availableQuantity} units ·{" "}
                {lot.delivery}
              </T>
            ))}
          {Array.isArray(answer) && (
            <T color={c.muted}>
              {answer.length} records found. Open Reports or Transactions for
              details.
            </T>
          )}
          {answer &&
            !Array.isArray(answer) &&
            "records" in answer &&
            answer.records?.map((record) => (
              <View
                key={record._id}
                style={{
                  gap: 4,
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderColor: c.border,
                }}
              >
                <T weight="bold">
                  {record.kind.replaceAll("_", " ")} · {record.date}
                </T>
                {record.unitPrice !== undefined && (
                  <T>
                    {record.productName ?? "Product"}: {record.quantity} units
                    at ₹{record.unitPrice}/unit
                  </T>
                )}
                <T>Total: {rupees(record.total)}</T>
                {(record.kind === "purchase" || record.kind === "sale") && (
                  <T>
                    Paid: {rupees(record.paid)} · Balance:{" "}
                    {rupees(record.total - record.paid)}
                  </T>
                )}
                <Button
                  title="Open transaction"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/records/[id]",
                      params: { id: record._id },
                    })
                  }
                />
              </View>
            ))}
          {answer &&
            !Array.isArray(answer) &&
            "records" in answer &&
            answer.records?.length === 0 &&
            answer.filteredKind &&
            answer.contactId && (
              <Button
                title={`Show all transactions for ${answer.contactName}`}
                variant="secondary"
                disabled={coolingDown || processing}
                onPress={() =>
                  void understand("transaction details", answer.contactId)
                }
              />
            )}
          {result.intent === "CREATE_INVOICE_DRAFT" &&
            answer &&
            !Array.isArray(answer) &&
            "saleId" in answer && (
              <Button
                title="Review sale for invoice"
                onPress={() =>
                  router.push({
                    pathname: "/records/[id]",
                    params: { id: String(answer.saleId) },
                  })
                }
              />
            )}
          {result.intent === "SHARE_INVOICE" && (
            <Button
              title="Open invoices"
              onPress={() => router.push("/invoices")}
            />
          )}
        </Card>
      )}
      {savedRecord && (
        <Card>
          <T size={19} weight="bold">
            Transaction saved
          </T>
          <T>
            {savedRecord.kind.replaceAll("_", " ")} ·{" "}
            {rupees(savedRecord.total)}
          </T>
          <Button
            title="Open transaction"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/records/[id]",
                params: { id: savedRecord._id },
              })
            }
          />
        </Card>
      )}
      {savedCatalog && (
        <Card>
          <T size={19} weight="bold">
            {savedCatalog.name} added
          </T>
          <Button
            title={
              savedCatalog.kind === "product"
                ? "Open inventory"
                : "Open contact"
            }
            variant="secondary"
            onPress={() =>
              savedCatalog.kind === "product"
                ? router.push("/inventory")
                : router.push({
                    pathname: "/contact/[id]",
                    params: { id: savedCatalog.entityId },
                  })
            }
          />
        </Card>
      )}
      {!result && !text && !processing && !audio.isRecording && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {[
            {
              title: "Today's sales",
              icon: Wallet,
              command: "How much sales has happened today?",
            },
            {
              title: "Check stock",
              icon: Package,
              command: "ஸ்டாக் எவ்வளவு இருக்கு?",
            },
          ].map((suggestion) => (
            <Pressable
              key={suggestion.title}
              accessibilityRole="button"
              accessibilityLabel={suggestion.title}
              disabled={processing || coolingDown || audio.isRecording}
              onPress={() => {
                void understand(suggestion.command);
              }}
              style={({ pressed }) => ({
                minWidth: 0,
                minHeight: 44,
                paddingVertical: 10,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 10,
                backgroundColor: pressed ? c.elevated : "transparent",
                opacity:
                  processing || coolingDown || audio.isRecording
                    ? 0.5
                    : pressed
                      ? 0.7
                      : 1,
                gap: 10,
              })}
            >
              <suggestion.icon size={16} color={c.muted} />
              <View style={{ gap: 3 }}>
                <T size={13} weight="medium">
                  {suggestion.title}
                </T>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <ConfirmationSheet
        visible={catalogReview && !!result?.catalogAction}
        onClose={() => {
          if (!saving) setCatalogReview(false);
        }}
      >
        {result?.catalogAction && (
          <>
            <T size={19} weight="bold">
              New {result.catalogAction.kind}
            </T>
            <Card>
              <CatalogDetails action={result.catalogAction} />
            </Card>
            {result.catalogAction.kind === "product" && (
              <T size={12} color={c.muted}>
                {result.catalogAction.input.quantity !== undefined ||
                result.catalogAction.input.unitPrice !== undefined ||
                result.catalogAction.purchaseInput?.kind === "purchase"
                  ? "Next, I’ll ask for any remaining purchase details by voice. Stock is added after you review and confirm the purchase."
                  : "This adds the product to your catalog. Use Add stock by voice in Inventory to receive stock."}
              </T>
            )}
            <ErrorNotice error={reviewError} />
            <Button
              title={`Confirm & add ${result.catalogAction.kind}`}
              busy={saving}
              onPress={() => void confirmCatalog()}
            />
          </>
        )}
      </ConfirmationSheet>
      <ConfirmationSheet
        visible={!!draft}
        onClose={() => {
          if (!saving) setDraft(null);
        }}
      >
        {draft && (
          <>
            <T color={c.muted}>
              Check the details below. Nothing is saved until you confirm.
            </T>
            <Card>
              <T size={19} weight="bold">
                {draft.input.kind.replaceAll("_", " ")}
              </T>
              {result?.summary?.contactName && (
                <T>Account: {result.summary.contactName}</T>
              )}
              {result?.summary?.productName && (
                <T>Product: {result.summary.productName}</T>
              )}
              <T>Date: {draft.input.date}</T>
              {(draft.input.kind === "purchase" ||
                draft.input.kind === "sale") && (
                <>
                  <T>
                    Quantity:{" "}
                    {stockQuantity(
                      draft.input.quantity ?? 0,
                      result?.summary?.unit ?? "unit",
                    )}{" "}
                    · Price per {stockUnit(result?.summary?.unit ?? "unit")}: ₹
                    {draft.input.unitPrice}
                  </T>
                  {!!result?.summary?.weightGrams && !!result.summary.unit && (
                    <T>
                      {stockUnitWeight(
                        result.summary.weightGrams,
                        result.summary.unit,
                      )}{" "}
                      ·{" "}
                      {stockWeight(
                        draft.input.quantity ?? 0,
                        result.summary.weightGrams,
                      )}{" "}
                      total
                    </T>
                  )}
                  <T>Delivery: {draft.input.delivery}</T>
                  {[
                    draft.input.transport,
                    draft.input.loading,
                    draft.input.unloading,
                    draft.input.otherCosts,
                  ].some((value) => Number(value) > 0) && (
                    <T>
                      Extra costs: ₹
                      {[
                        draft.input.transport,
                        draft.input.loading,
                        draft.input.unloading,
                        draft.input.otherCosts,
                      ]
                        .reduce((sum, value) => sum + Number(value), 0)
                        .toFixed(2)}
                    </T>
                  )}
                  {Number(draft.input.discount) > 0 && (
                    <T>Discount: ₹{draft.input.discount}</T>
                  )}
                </>
              )}
              {result?.summary?.sourceLabel && (
                <T>Applied to: {result.summary.sourceLabel}</T>
              )}
              {!!draft.input.sourceId && !result?.summary?.sourceLabel && (
                <T size={12} color={c.muted}>
                  Source transaction: {draft.input.sourceId}
                </T>
              )}
              {(draft.input.kind === "customer_payment" ||
                draft.input.kind === "supplier_payment") && (
                <T>Payment method: {draft.input.method.toUpperCase()}</T>
              )}
              {draft.totals.tax > 0 && <T>Tax: {rupees(draft.totals.tax)}</T>}
              <T size={23} color={c.accent} weight="bold">
                Total: {rupees(draft.totals.total)}
              </T>
              {draft.input.dueDate && <T>Due: {draft.input.dueDate}</T>}
              {!!draft.input.reference && (
                <T>Reference: {draft.input.reference}</T>
              )}
              {!!draft.input.notes && <T>{draft.input.notes}</T>}
            </Card>
            <ErrorNotice error={reviewError} />
            <Button
              title="Confirm & save"
              busy={saving}
              onPress={() => void confirmTransaction()}
            />
            <Button
              title="Go back"
              variant="secondary"
              disabled={saving}
              onPress={() => setDraft(null)}
            />
          </>
        )}
      </ConfirmationSheet>
    </Screen>
  );
}
