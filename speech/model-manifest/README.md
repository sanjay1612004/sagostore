# Multilingual speech models

Source: [ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp). Use `base-q5_1` initially; compare `small-q5_1` against consenting traders' Tamil recordings before selecting production defaults. Never use a `.en` model.

`download-model.mjs` resolves the upstream repository revision, downloads that exact revision, verifies its LFS SHA256, and stores the revision/hash in an ignored local manifest. Keep production manifests with release metadata. The base and small models use the upstream Whisper license; retain the source license with the deployment.

Run exactly one queue worker. The default persistent whisper-server keeps the model in memory; CLI mode is a development fallback that reloads it. Neither latency nor Tamil accuracy has been benchmarked on your Oracle hardware yet.
