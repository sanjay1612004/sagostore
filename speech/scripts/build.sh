#!/usr/bin/env bash
set -euo pipefail
speech_root="$(cd "$(dirname "$0")/.." && pwd)"
command -v cmake >/dev/null || { echo 'CMake 3.20+ is required.' >&2; exit 1; }
command -v g++ >/dev/null || { echo 'A C++ compiler is required.' >&2; exit 1; }
if [[ ! -d "$speech_root/whisper.cpp/.git" ]]; then
  git clone --branch v1.9.5 --depth 1 https://github.com/ggml-org/whisper.cpp.git "$speech_root/whisper.cpp"
fi
[[ "$(git -C "$speech_root/whisper.cpp" describe --tags --exact-match)" == 'v1.9.5' ]] || { echo 'Expected whisper.cpp v1.9.5 checkout.' >&2; exit 1; }
cmake -S "$speech_root/whisper.cpp" -B "$speech_root/whisper.cpp/build" -DCMAKE_BUILD_TYPE=Release -DGGML_CUDA=OFF -DWHISPER_BUILD_SERVER=ON -DWHISPER_BUILD_TESTS=OFF
cmake --build "$speech_root/whisper.cpp/build" --config Release -j "${SPEECH_BUILD_JOBS:-2}"
echo 'CPU-only whisper.cpp built. Run node speech/scripts/download-model.mjs base-q5_1 next.'
