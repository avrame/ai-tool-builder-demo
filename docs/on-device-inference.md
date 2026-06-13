# On-Device Inference Landscape

## Architecture Comparison

### Server-Based (Current)
```
Browser -> fetch -> Backend API -> LLM Server -> Response
```
- Requires internet connection
- API costs per token
- Privacy concerns (data leaves device)
- Server infrastructure needed

### On-Device Browser (Target)
```
Browser -> WebGPU -> LLM Model -> Response
```
- No internet needed after model download
- Zero API costs
- Full privacy (data stays on device)
- No server infrastructure
- Latency depends on device hardware

### On-Device Mobile App
```
App -> Native ML Framework -> LLM Model -> Response
```
- Requires app store distribution
- Native performance (best)
- Platform-specific code (iOS/Android)
- Larger app bundle sizes

## On-Device Inference Options

### 1. WebLLM (MLC AI)
- **Runtime**: WebGPU (GPU-accelerated)
- **Model Format**: GGUF (via MLC runtime)
- **Strengths**: Best mobile performance, automatic model management, streaming
- **Weaknesses**: WebGPU support still maturing on some devices
- **Best For**: Chat, code generation, tool building

### 2. Transformers.js (Hugging Face)
- **Runtime**: ONNX Runtime Web (WebGPU/WASM)
- **Model Format**: ONNX
- **Strengths**: General-purpose (NLP, vision, audio), HF ecosystem
- **Weaknesses**: Less LLM-optimized, larger models
- **Best For**: Classification, embedding, small NLP tasks

### 3. WebNN (Chrome)
- **Runtime**: WebNN API (new, experimental)
- **Model Format**: TensorFlow Lite / ONNX
- **Strengths**: Direct hardware access (NPU/GPU/CPU)
- **Weaknesses**: Chrome-only, limited model support
- **Best For**: Future-proofing, NPU devices

### 4. MediaPipe (Google)
- **Runtime**: WebAssembly
- **Model Format**: TensorFlow Lite
- **Strengths**: Good for vision/audio models
- **Weaknesses**: Limited LLM support
- **Best For**: Multimodal apps

### 5. Candle (Rust -> WASM)
- **Runtime**: WebAssembly
- **Model Format**: GGML
- **Strengths**: Fast WASM inference
- **Weaknesses**: No WebGPU acceleration
- **Best For**: Desktop browsers, no-GPU devices

## Model Size vs Device Capability

### High-End Mobile (iPhone 15+, Galaxy S24+)
- RAM: 8-12GB
- GPU: Powerful (Apple Neural Engine, Adreno 750)
- Can run: 3-7B parameter models (q4 quantized)
- Speed: 10-30 tokens/sec

### Mid-Range Mobile (iPhone 12-14, Galaxy S21-23)
- RAM: 6-8GB
- GPU: Moderate
- Can run: 1-3B parameter models (q4 quantized)
- Speed: 5-15 tokens/sec

### Low-End / Older Devices
- RAM: 4GB
- GPU: Basic
- Can run: <1B parameter models or quantized 1-2B
- Speed: 2-8 tokens/sec
- Fallback: WASM-only, no WebGPU

## Browser Support Matrix

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

For devices without WebGPU support:

1. **Primary**: WebLLM with WebGPU (best performance)
2. **Fallback 1**: WebLLM with WASM (slower, works everywhere)
3. **Fallback 2**: Server-based API (requires internet)
4. **Fallback 3**: Graceful degradation with error message

```typescript
async function getEngine() {
  if (navigator.gpu) {
    return CreateMLCEngine(modelId, {
      useWebGPU: true,
      initProgressCallback: reportCallback,
    });
  } else {
    // Fallback to server or show error
    throw new Error("WebGPU not supported on this device");
  }
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
- Browser storage limits (IndexedDB)
- Memory constraints on mobile
- No server-side safety filters
