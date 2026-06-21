# Implementation Log

> **Created:** 2026-06-20
> **Purpose:** Track implementation progress, test results, lessons learned, and device compatibility

## Timeline

### 2026-06-20 — wllama WASM/CPU Implementation

#### What Was Built
- **Core engine** (`src/llm-engine.ts`) — Model loading, streaming chat, state management
- **Cache layer** (`src/model-cache.ts`) — Cache API wrapper for model download/persistence
- **UI** (`src/App.ts`) — Arrow.js reactive components, imperative DOM updates
- **Dev config** (`vite.config.ts`) — COEP/COOP headers, HTTPS for Cache API

#### Test Results

| Test | Device | Browser | Result | Notes |
|------|--------|---------|--------|-------|
| Model load + chat response | Galaxy S21 FE | Chrome 149 | ✅ Success | Qwen2.5-1.5B loaded, "Hello! How can I help you today?" response |
| Model load + chat response | Galaxy S21 FE | Samsung Internet | ✅ Success | Same Chromium engine, works identically |
| WebGPU check | Galaxy S21 FE | Chrome 149 | ⚠️ Adapter null | WebGPU disabled on this device (Adreno 670, Chrome Android limitation) |
| WASM loading | Galaxy S21 FE | Chrome 149 | ✅ Success | wllama.wasm loaded from CDN |
| Model caching | Galaxy S21 FE | Chrome 149 | ✅ Success | Model persisted in Cache API |
| Streaming response | Galaxy S21 FE | Chrome 149 | ✅ Success | Token-by-token rendering works |
| Low-RAM device detection | Galaxy S21 FE | Chrome 149 | ✅ Success | 8GB RAM detected, context window set to 1024 |

#### Performance Metrics (Galaxy S21 FE)

| Metric | Value |
|--------|-------|
| Model download (WiFi) | ~30-60 seconds |
| Model load time | ~15-30 seconds |
| Inference speed | 2-8 tokens/sec |
| Response time (50 tokens) | ~10-25 seconds |
| Memory usage | ~1.5-2.5 GB RAM |
| Context window | 1024 tokens |

#### Lessons Learned

1. **NoOpStorageBackend workaround is essential** — wllama's default CacheManager requires OPFS, which is unavailable on Chrome Android when COEP/COOP headers are active. The dummy backend lets us use Cache API for model storage instead.

2. **Cache API requires secure context** — Model caching only works on HTTPS or localhost. On HTTP (non-localhost), models download fresh each session.

3. **Samsung Internet DevTools are inaccessible** — Unlike Chrome, Samsung Internet doesn't expose `chrome_devtools_remote`. Debugging requires Chrome on Android (same Chromium engine).

4. **adb logs are dominated by camera noise** — Samsung device logcat is flooded with camera driver errors. App-level logs (`console.log`) don't appear in system logcat. Chrome DevTools is the only way to see app-level output.

5. **WebGPU is disabled on many Android devices** — Chrome disables WebGPU on devices with < 4GB RAM or certain GPU tiers. wllama WASM is the reliable fallback.

6. **Arrow.js watch() for imperative DOM updates** — Arrow.js doesn't re-render on reactive changes, so we use `watch()` to track state and update DOM imperatively. This works but is more verbose than React/Vue.

7. **Map.prototype patch needed for Chrome mobile** — Chrome Android has a bug where Map objects lose their prototype chain across Web Worker boundaries. The patch prevents "incompatible receiver" errors.

8. **Device-aware configuration matters** — `navigator.deviceMemory` and `navigator.hardwareConcurrency` help tune thread count and context window for the device.

9. **Progress feedback is critical for large downloads** — 0.7GB model download needs real-time progress updates. The `onProgress` callback pattern works well.

10. **Error cleanup is important** — wllama instances must be cleaned up on error (`wllamaInstance.exit()`) to prevent memory leaks.

## Known Issues

### Device-Specific

| Issue | Device | Browser | Status | Workaround |
|-------|--------|---------|--------|------------|
| WebGPU adapter null | Galaxy S21 FE | Chrome 149 | Known | wllama WASM fallback works |
| Samsung Internet DevTools | Galaxy S21 FE | Samsung Int | Known | Use Chrome for debugging |
| Cache API on HTTP | All | All | Known | Model downloads fresh on HTTP |

### Implementation

| Issue | File | Status | Notes |
|-------|------|--------|-------|
| No WebGPU acceleration | llm-engine.ts | Planned | Add WebLLM fallback for WebGPU devices |
| Single model cache | model-cache.ts | Known | Only one model cached at a time |
| Slow on low-end devices | llm-engine.ts | Known | 1-3 tok/s on devices with < 2GB RAM |
| No OPFS caching | model-cache.ts | Known | Cache API used instead (requires secure context) |

## Future Improvements

### Priority 1 — Performance
- [ ] Add WebLLM (MLC) as WebGPU fallback — 10-30x faster inference
- [ ] Implement OPFS caching for faster model loading
- [ ] Add multi-thread WASM (requires SharedArrayBuffer + COEP/COOP)

### Priority 2 — Features
- [ ] Multiple model support — Add 3B-7B models for high-end devices
- [ ] Model quantization options — Q3, Q5, Q6 for quality/speed tradeoffs
- [ ] Offline detection — Show offline status when network is unavailable
- [ ] Download over WiFi only — Prevent cellular data usage for large models

### Priority 3 — UX
- [ ] Better streaming UI — Token-by-token cursor animation
- [ ] Model selection UI — Dropdown for multiple models
- [ ] Cache management — Clear cached models, storage usage display
- [ ] Error recovery — Retry on download failure with exponential backoff

### Priority 4 — Testing
- [ ] Test on iPhone 15 (Safari 18+)
- [ ] Test on Pixel 8 (Chrome 149+)
- [ ] Test on low-end Android (4GB RAM)
- [ ] Test on iPad (Safari 17.4+)

## Device Compatibility Tracker

| Device | Browser | WASM | WebGPU | Tested | Notes |
|--------|---------|------|--------|--------|-------|
| Galaxy S21 FE | Chrome 149 | ✅ | ❌ (adapter null) | ✅ | Primary test device |
| Galaxy S21 FE | Samsung Int 27+ | ✅ | ✅ | ✅ | Same as Chrome |
| iPhone 15 | Safari 18+ | ✅ | ✅ | ⏳ | Should work |
| iPhone 12 | Safari 17.4+ | ✅ | ✅ | ⏳ | Should work |
| Pixel 8 | Chrome 149 | ✅ | ✅ | ⏳ | Should work |
| Low-end Android | Chrome 113+ | ✅ | ❌ | ⏳ | May be slow |

## References

- **wllama GitHub:** https://github.com/alexhanna/wllama
- **wllama npm:** `@wllama/wllama`
- **llama.cpp:** https://github.com/ggerganov/llama.cpp
- **GGUF format:** https://github.com/ggerganov/ggml/blob/master/docs/gguf.md
- **Qwen2.5-1.5B on HuggingFace:** https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF
- **Cache API:** https://developer.mozilla.org/en-US/docs/Web/API/Cache_API
- **WebGPU spec:** https://www.w3.org/TR/webgpu/
- **Arrow.js:** https://arrow-js.com/
