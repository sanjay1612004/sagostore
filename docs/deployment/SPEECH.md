# Tamil and English speech recognition

## Cloud recognition for mixed Tamil and English

Set `SPEECH_ENGINE=sarvam` to use [Sarvam Saaras](https://docs.sarvam.ai/api/getting-started/models/saaras). The integration uses `saaras:v4`, `mode=codemix`, and automatic language detection (`language_code=unknown`). This preserves Tamil in Tamil script and English words in English, including when both occur within a recording. It does not translate the recording into English.

Create an API key in the [Sarvam dashboard](https://dashboard.sarvam.ai) and configure **only `server/.env`** (or your server's secret environment):

```dotenv
SPEECH_ENGINE=sarvam
SARVAM_API_KEY=your_private_key
SARVAM_MODEL=saaras:v4
VOICE_MAX_DURATION_SECONDS=30
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

Install FFmpeg and FFprobe or set those variables to their absolute executable paths. Restart both the API and the single voice worker after changing configuration:

```bash
npm run dev:server
# This starts both API and worker together.
```

To run them separately, use `npm run dev:api -w server` and `npm run worker -w server` in separate terminals. Keep the worker terminal running; an API alone accepts typed commands but cannot transcribe recordings. `GET /api/voice/config` reports worker heartbeat availability separately from key readiness. A missing worker prevents new upload admission and leaves any existing queued recording visible with an offline explanation and Cancel control.

Cloud mode needs no local Whisper model or `whisper-server`. Audio is still validated and converted to mono 16 kHz WAV, then sent by the worker over HTTPS to `https://api.sarvam.ai/speech-to-text`. For Saaras v4, the worker sends name hints only when answering a current customer/supplier or product selection question, using the choices actually displayed. Free-form recordings and customer/supplier/product creation or correction omit saved-name hints, so unfamiliar names are not biased toward existing stores. Hints are bounded to 50 distinct phrases of at most 64 characters, never inserted into the transcript, and do not guarantee recognition accuracy. Saaras v3 omits this unsupported field. See [Sarvam keyterm prompting](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/how-to/keyterms).

Sarvam charges according to the account's usage plan; the application does not automatically retry billable recognition requests. Keep the API key out of mobile configuration, source control, logs and chat messages. The app displays that cloud recognition sends recordings to a speech service.

`GET /api/voice/config` exposes the selected provider, setup readiness and recording limit, never the key. Readiness here means a key has been supplied; it does not assert that the key is valid or has credits. Without a key, recording admission returns a clear setup error before storing an upload; typed commands continue to work. The cloud REST limit is 30 seconds, even if the local recording configuration allows longer audio. `SARVAM_MODEL=saaras:v3` is available as an explicit alternative.

Errors distinguish credentials, rate limits, invalid recordings, timeouts and provider availability. No raw provider error bodies are exposed. Successful transcripts go through [AI understanding](COMMAND_AI.md), server validation and transaction review; recognition alone never writes a financial record. Groq is primary, with an optional Gemini backup for exhausted Groq quotas. Speech recognition has separate credentials and usage charges. Test real Tamil-English recordings and verify names, quantities and amounts before confirming anything.

An opt-in end-to-end cloud smoke test uses the upstream public English recording, an isolated temporary MongoDB replica set and your cloud credentials. It creates no financial records and uses API credits:

```bash
cd server
RUN_SARVAM_INTEGRATION=1 node --env-file=.env ../node_modules/vitest/vitest.mjs run tests/speech.integration.test.ts
# RUN_SPEECH_INTEGRATION=1 instead selects local Whisper.
```

## Local Whisper alternative

The local alternative requires no paid speech API. With `SPEECH_ENGINE=server`, the worker uses a persistent **whisper.cpp v1.9.5** server on `127.0.0.1:8080`; CPU-only inference keeps the model loaded. The model is multilingual Base Q5_1, with Small Q5_1 offered for accuracy/latency comparison.

Upstream references: [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [server protocol](https://github.com/ggml-org/whisper.cpp/tree/master/examples/server).

## Build

Install a C++ compiler, CMake 3.20+, Git, FFmpeg and FFprobe. ARM64 Oracle builds use the same commands on the VM:

```bash
bash speech/scripts/build.sh
node speech/scripts/download-model.mjs base-q5_1
speech/whisper.cpp/build/bin/whisper-server \
  --host 127.0.0.1 --port 8080 \
  -m speech/models/ggml-base-q5_1.bin -l ta -t 2 -p 1 -ng
```

The downloader pins the resolved upstream repository revision, checks SHA256 against upstream LFS metadata, and records a local manifest. Model binaries and recordings are ignored by version control. Keep upstream license files with deployed model/build artifacts.

Set `SPEECH_ENGINE=server`, `WHISPER_SERVER_URL=http://127.0.0.1:8080`, and correct executable paths in `server/.env`, then run `npm run worker -w server`. The API and worker must share the same configured audio directory, Atlas database, secrets and business models. `FFMPEG_PATH` / `FFPROBE_PATH` accept absolute paths for development. Never expose the upstream speech server directly to the Internet, including its model-loading endpoint.

For a development-only CLI fallback, use `SPEECH_ENGINE=cli`, set `WHISPER_CLI_PATH` and `SPEECH_MODEL_PATH`. CLI mode reloads the model for each job and is slower; the persistent server is the production default.

## Tamil accuracy

The worker explicitly requests Tamil transcription (`language=ta`, `translate=false`) and uses beam search with `SPEECH_BEAM_SIZE=5` by default. It supplies a short vocabulary hint containing business terms. Saved names are included only for a current entity selection question; free-form recordings and new-name entry omit saved names. These hints can help recognition but do not guarantee correct names or amounts.

If Base mishears Tamil, try the larger multilingual Small model locally:

```bash
node speech/scripts/download-model.mjs small-q5_1
# Stop the previous whisper-server, then start the replacement from the repository root:
speech/whisper.cpp/build/bin/whisper-server \
  --host 127.0.0.1 --port 8080 \
  -m speech/models/ggml-small-q5_1.bin -l ta -t 2 -p 1 -ng
```

Set `SPEECH_MODEL_PATH` to the absolute Small model path in `server/.env` for CLI mode and in the service environment for systemd. A running server only changes models when restarted or explicitly reloaded; changing the worker environment alone does not change its model. Restart the API and worker after code/configuration changes.

Small uses more memory and CPU time. Compare the same real Tamil recordings with both models before selecting a production model. Check the displayed transcript separately from the interpreted command: a wrong transcript is a speech recognition issue, while a correct transcript with the wrong action is an AI extraction issue. Correct transcript errors and tap **Understand command** again; editing clears the previous interpretation.

## Processing and retention

The API accepts one authenticated compressed audio file, checks upload size/MIME/container signature, stores it under a random filename and returns a job ID. FFprobe verifies a real audio stream and finite duration of at most 30 seconds. FFmpeg converts it to mono 16 kHz PCM WAV. The worker sends the WAV to the configured speech provider, then Groq extracts a structured plan and the server validates its fields and references. Both typed and spoken commands use the same AI understanding path. There is no phrase-parser fallback.

The mobile UI polls actual queued/transcribing/understanding/completed/error states every second while focused. It displays the transcript as soon as the job reaches understanding, instead of waiting for the AI result. It allows cancellation, typed fallback and editing after processing completes. No job state commits purchases, sales or payments. The database commit happens only through the separate reviewed draft confirmation API.

Spoken follow-up questions use the device/browser text-to-speech engine. The app selects an installed Tamil voice (preferring India and enhanced quality), reads native-script Tamil with that voice, and reads Latin-script names or English choices separately with an English voice. Saved Tamil contact aliases are used as pronunciation labels when available; displayed names and choice values stay the same. Missing Tamil voice data produces a setup hint instead of allowing the system to misread Tamil using its default English voice. Enable/download a Tamil voice in the device's text-to-speech settings, then use **Repeat question**. Voice discovery is bounded to 1.5 seconds and starting a recording cancels pending/queued playback. Voice quality still depends on the available speech engine; automated checks do not measure real pronunciation.

The worker bounds database socket waits to 15 seconds, pool waits to 10 seconds, and queue-lock queries to 5 seconds. After a network/pool timeout, closed connection or buffering timeout, it waits for any pending heartbeat, closes the connection normally and reconnects before retrying. It avoids a force-close, which can leave existing Mongoose models unable to run operations after reconnection. `WORKER_DATABASE_RECOVERED` confirms a new heartbeat was published; failure logs include a safe failure category and connection state without connection strings. A recovering process can reacquire its own lease without waiting for expiry, while a different worker remains excluded. Its completion log separates queue wait, transcription and understanding times without logging audio or transcript contents. A live process with old queued jobs and no worker lock can indicate an unresponsive worker; recover the worker process before attributing that delay to the speech provider.

Temporary audio is removed after success/failure and queued cancellation. Cancellation of running inference marks the job cancelled immediately, but CPU processing may finish before cleanup; its result is not published as completed. Stale worker leases are marked failed on restart. Abandoned files older than one day are swept. Use filesystem quotas and monitoring as a second bound.

Run **one worker service**. Queue admission is serialized with a MongoDB gate, so concurrent uploads cannot exceed the configured active-job cap. A singleton expiring worker lease also prevents accidental extra workers from claiming inference concurrently. The upstream model server serializes model access. Horizontal multi-slot inference requires a reviewed extension and resource benchmarks.

## Benchmark with real Tamil

Record consented examples from the actual trader: colloquial Tamil, code switching, names, numbers, corrections, and different background noise levels. Convert them to WAV and create a local JSON manifest:

```json
[
  {
    "path": "/private/recording.wav",
    "expected": "இன்னைக்கு ஐம்பது மூட்டை வாங்கினேன்",
    "model": "base-q5_1"
  }
]
```

```bash
node speech/scripts/benchmark.mjs /private/recordings.json /private/base-report.json
node speech/scripts/download-model.mjs small-q5_1
# Restart whisper-server with the Small model, then run the same samples.
```

Measure word error rate, extracted amount/account accuracy, median/P95 latency and service RSS/CPU. Reports contain transcripts and are sensitive. Base/Small Tamil acceptance and Oracle ARM64 performance have not been measured yet; do not promise instant recognition on a 2-OCPU VM.
