# On-Device Inference Landscape

> **Updated:** 2026-06-20
> **Status:** wllama (WASM/CPU) implementation is live and tested on mobile

## Architecture Comparison

### Server-Based (Legacy)
```
Browser -> fetch -> Backend API -> LLM Server -> Response
```
- Requires internet connection
- API costs per token
- Privacy concerns (data leaves device)
- Server infrastructure needed

### On-Device Browser — wllama (Current Implementation)
```
Browser -> WebAssembly -> LLM Model -> Response
```
- No internet needed after model download
- Zero API costs
- Full privacy (data stays on device)
- No server infrastructure
- Latency depends on CPU (2-8 tok/s on mobile)
- **Works on any browser with WASM support**

### On-Device Browser — WebLLM (Future)
```
Browser -> WebGPU -> LLM Model -> Response
```
- No internet needed after model download
- Zero API costs
- Full privacy (data stays on device)
- Latency depends on GPU (15-30 tok/s on mobile)
- Requires WebGPU support (Chrome 113+, Samsung Internet 27+)

### On-Device Mobile App
```
App -> Native ML Framework -> LLM Model -> Response
```
- Requires app store distribution
- Native performance (best)
- Platform-specific code (iOS/Android)
- Larger app bundle sizes

## On-Device Inference Options

### 1. wllama (WASM/CPU) — **IMPLEMENTED**
- **Runtime:** WebAssembly (llama.cpp port)
- **Model Format:** GGUF (standard, any HuggingFace GGUF)
- **Strengths:** Works everywhere, no GPU needed, standard model format, easy model selection
- **Weaknesses:** Slower (CPU only, 2-8 tok/s on mobile), no GPU acceleration
- **Best For:** Universal compatibility, devices without WebGPU, quick prototyping
- **Status:** ✅ Live on Samsung Galaxy S21 FE (Chrome Android)

### 2. WebLLM (MLC AI)
- **Runtime:** WebGPU (GPU-accelerated)
- **Model Format:** MLC-compiled (via TVM)
- **Strengths:** Best mobile performance (15-30 tok/s), automatic model management, streaming
- **Weaknesses:** Requires WebGPU, MLC format conversion pipeline, limited model selection
- **Best For:** Chat, code generation, tool building on WebGPU-capable devices
- **Status:** Planned as fallback for WebGPU devices

### 3. Transformers.js (Hugging Face)
- **Runtime:** ONNX Runtime Web (WebGPU/WASM)
- **Model Format:** ONNX
- **Strengths:** General-purpose (NLP, vision, audio), HF ecosystem
- **Weaknesses:** Less LLM-optimized, larger models
- **Best For:** Classification, embedding, small NLP tasks

### 4. WebNN (Chrome)
- **Runtime:** WebNN API (new, experimental)
- **Model Format:** TensorFlow Lite / ONNX
- **Strengths:** Direct hardware access (NPU/GPU/CPU)
- **Weaknesses:** Chrome-only, limited model support
- **Best For:** Future-proofing, NPU devices

### 5. Candle (Rust -> WASM)
- **Runtime:** WebAssembly
- **Model Format:** GGML
- **Strengths:** Fast WASM inference
- **Weaknesses:** No WebGPU acceleration
- **Best For:** Desktop browsers, no-GPU devices

## Model Size vs Device Capability

### High-End Mobile (iPhone 15+, Galaxy S24+)
- RAM: 8-12GB
- GPU: Powerful (Apple Neural Engine, Adreno 750)
- Can run: 3-7B parameter models (q4 quantized)
- Speed (WebGPU): 10-30 tokens/sec
- Speed (WASM): 5-15 tokens/sec

### Mid-Range Mobile (iPhone 12-14, Galaxy S21-23)
- RAM: 6-8GB
- GPU: Moderate
- Can run: 1-3B parameter models (q4 quantized)
- Speed (WebGPU): 10-25 tokens/sec
- Speed (WASM): 2-8 tokens/sec

### Low-End / Older Devices
- RAM: 4GB
- GPU: Basic or none
- Can run: <1B parameter models or quantized 1-2B
- Speed (WASM): 1-5 tokens/sec
- Fallback: WASM-only, no WebGPU

## Browser Support Matrix

### WASM Support (Universal)

| Browser | WASM | Status |
|---------|------|--------|
| Chrome 66+ | Yes | Stable, default |
| Firefox 52+ | Yes | Stable, default |
| Safari 11.1+ | Yes | Stable, default |
| Edge 15+ | Yes | Stable, default |
| Samsung Internet 6+ | Yes | Stable, default |
| Opera 53+ | Yes | Stable, default |

### WebGPU Support (For WebLLM Fallback)

| Browser | WebGPU | Status |
|---------|--------|--------|
| Chrome 113+ | Yes | Stable, default |
| Edge 113+ | Yes | Stable, default |
| Firefox 121+ | Yes | Stable, default |
| Safari 17.4+ | Yes | Stable, default (since Nov 2025) |
| Samsung Internet 27+ | Yes | Stable |
| Opera 99+ | Yes | Stable |

**All major browsers now support WebGPU** as of late 2025.

## Fallback Strategy

For devices without WebGPU support (current implementation):

1. **Primary:** wllama with WASM (CPU inference — works everywhere)
2. **Future Fallback 1:** WebLLM with WebGPU (GPU acceleration — faster)
3. **Future Fallback 2:** Server-based API (requires internet)
4. **Future Fallback 3:** Graceful degradation with error message

For devices with WebGPU support (future implementation):

1. **Primary:** WebLLM with WebGPU (best performance)
2. **Fallback:** wllama with WASM (CPU inference — works everywhere)
3. **Fallback:** Server-based API (requires internet)

```typescript
async function getEngine() {
  // Check WebGPU first
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        return CreateMLCEngine(modelId, {
          useWebGPU: true,
          initProgressCallback: reportCallback,
        });
      }
    } catch (e) {
      console.warn("WebGPU not available, falling back to WASM:", e);
    }
  }
  
  // Fallback to wllama WASM
  return loadWllamaModel(modelId, reportCallback);
}
```

## Privacy & Security

### On-Device Benefits
- No data leaves the device
- No API keys needed
- No third-party data collection
- Works offline
- No rate limits

### Considerations
- Model files are large (1-4GB downloads)
- Browser storage limits (IndexedDB/Cache API)
- Memory constraints on mobile
- No server-side safety filters
- WASM performance is slower than native/WebGPU

## Implementation Notes

### Current Stack (wllama)
- **Runtime:** `@wllama/wllama@3.5.1` (WASM)
- **Model:** Qwen2.5-1.5B-Instruct Q4_K_M (GGUF)
- **Cache:** Browser Cache API (not OPFS)
- **Thread count:** 2-4 (device-aware)
- **Context window:** 1024 tokens (low-RAM devices)
- **Headers:** COEP/COOP set for future compatibility

### Why wllama over WebLLM?
1. **Universal compatibility** — Works on any browser with WASM (no WebGPU needed)
2. **Standard model format** — GGUF is the industry standard, any HuggingFace GGUF works
3. **Simpler model selection** — No MLC conversion pipeline needed
4. **Proven on mobile** — Tested and working on Samsung Galaxy S21 FE
5. **Easier debugging** — WASM is more debuggable than WebGPU compute shaders

### Why add WebLLM later?
1. **Performance** — 10-30x faster with GPU acceleration
2. **Better UX** — Faster response times (5-10s vs 15-30s for 50-token responses)
3. **Larger models** — GPU can handle 3B-7B models that would be unusable on CPU
