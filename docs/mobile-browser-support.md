# Mobile Browser Support

> **Updated:** 2026-06-20
> **Tested on:** Samsung Galaxy S21 FE (Chrome Android, Adreno 670)
> **Current runtime:** wllama v3.5.1 (WASM/CPU)

## WebGPU Support Matrix

### Desktop Browsers (Full Support)

| Browser | Version | WebGPU | Status |
|---------|---------|--------|--------|
| Chrome | 113+ | Yes | Stable, default |
| Edge | 113+ | Yes | Stable, default |
| Firefox | 121+ | Yes | Stable, default |
| Safari | 17.4+ | Yes | Stable (macOS 14.4+, iOS 17.4+) |
| Opera | 99+ | Yes | Stable |

### Mobile Browsers (Partial/Variable Support)

| Browser | Version | WebGPU | Status | Notes |
|---------|---------|--------|--------|-------|
| Chrome (Android) | 113+ | Yes | Stable | **Primary test platform** |
| Samsung Internet | 27+ | Yes | Stable | Chromium-based, good WebGPU |
| Firefox (Android) | 121+ | Yes | Stable | May need `about:config` flags |
| Safari (iOS) | 17.4+ | Yes | Stable | iOS 17.4+ required |
| Safari (iPadOS) | 17.4+ | Yes | Stable | iPadOS 17.4+ required |
| Edge (Android) | 113+ | Yes | Stable | Chromium-based |
| Brave | Based on Chromium | Yes | Varies | Depends on Chromium version |

### Browsers Without WebGPU Support

| Browser | Reason | Fallback |
|---------|--------|----------|
| iOS Safari < 17.4 | Apple hasn't enabled WebGPU | wllama WASM fallback |
| Firefox (iOS) | Uses WebKit engine, limited | wllama WASM fallback |
| Opera Mini | Compressed proxy, no GPU | Server-based fallback |
| UC Browser | Limited GPU access | wllama WASM fallback |

## WASM Support (Universal)

**All modern browsers support WebAssembly**, which is what our current implementation uses:

| Browser | WASM | Status |
|---------|------|--------|
| Chrome 66+ | Yes | Stable, default |
| Firefox 52+ | Yes | Stable, default |
| Safari 11.1+ | Yes | Stable, default |
| Edge 15+ | Yes | Stable, default |
| Samsung Internet 6+ | Yes | Stable, default |
| Opera 53+ | Yes | Stable, default |

**Our wllama implementation works on all browsers above.**

## Feature Detection

### Basic WebGPU Check

```typescript
async function checkWebGPUSupport(): Promise<boolean> {
  if (!("gpu" in navigator)) return false;
  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}
```

### GPU Adapter Info (for debugging)

```typescript
const adapter = await navigator.gpu.requestAdapter();
const info = await adapter.requestAdapterInfo();
// info: { vendor, architecture, device, description }
```

### Device Memory (RAM hint)

```typescript
// navigator.deviceMemory is unreliable on mobile
// Use as rough hint only
const ram = (navigator as any).deviceMemory; // 4, 8, 16, etc.
```

### Cache API Check

```typescript
const isCacheAvailable = () => {
  try {
    return typeof caches !== "undefined" && typeof caches.open === "function";
  } catch {
    return false;
  }
};
```

## Known Issues and Workarounds

### Chrome Android — WebGPU Disabled on Low-End Devices
- **Symptom:** `navigator.gpu` exists but `requestAdapter()` returns null
- **Cause:** Chrome disables WebGPU on devices with < 4GB RAM
- **Workaround:** wllama WASM fallback works regardless of WebGPU status

### Firefox Android — WebGPU Behind Flag
- **Symptom:** WebGPU not available even on supported versions
- **Cause:** Must enable `dom.webgpu.enabled` in `about:config`
- **Workaround:** wllama WASM fallback works regardless

### iOS Safari — WebGPU Limited to A12+ Chips
- **Symptom:** WebGPU works but performance varies widely
- **Cause:** Neural Engine only on A12+ (iPhone XS+)
- **Workaround:** wllama WASM fallback works on all iOS Safari versions

### Samsung Internet — Memory Pressure
- **Symptom:** App crashes when loading models > 1.5GB
- **Cause:** Samsung Internet has stricter memory limits than Chrome
- **Workaround:** Pre-load smaller models, clear cache between sessions

### Cache API — Requires Secure Context
- **Symptom:** Model caching fails on HTTP (non-localhost)
- **Cause:** Cache API only works in secure contexts (HTTPS or localhost)
- **Workaround:** Model downloads fresh each session on HTTP (cached in memory)

### Samsung Internet DevTools
- **Symptom:** Cannot debug Samsung Internet via Chrome DevTools
- **Cause:** Samsung Internet doesn't expose `chrome_devtools_remote`
- **Workaround:** Use Chrome on Android for debugging, Samsung Internet for testing

## Browser Fallback Strategy

```
1. Check WebGPU support → if yes, use WebLLM (on-device, GPU)
2. If no WebGPU → use wllama WASM (on-device, CPU)
3. If WASM fails → check if online → if yes, use server-based API
4. If no server → show error message with model recommendations
```

### Implementation in `llm-engine.ts`

```typescript
// checkWebGPUSupport() is called on app load (non-blocking)
// If false, engineState.webgpuSupported = false
// App renders with warning banner (see App.ts)
// wllama is the primary runtime — WebGPU is a future optimization
```

## Testing on Real Devices

### Test Results

| Device | Browser | Result | Notes |
|--------|---------|--------|-------|
| Galaxy S21 FE | Chrome 149 | ✅ Works | Qwen2.5-1.5B loaded, streaming response |
| Galaxy S21 FE | Samsung Int 27+ | ✅ Works | Same as Chrome (Chromium-based) |
| iPhone 15 | Safari 18+ | ⏳ Untested | Should work (WASM supported) |
| Pixel 8 | Chrome 149 | ⏳ Untested | Should work (better CPU) |
| Low-end Android | Chrome 113+ | ⏳ Untested | May be slow (1-3 tok/s) |

### Recommended Test Devices

| Device | Browser | What to Test |
|--------|---------|-------------|
| iPhone 15 (iOS 17.4+) | Safari | Full WebGPU, all models |
| iPhone 12 (iOS 17.4+) | Safari | WebGPU, memory limits |
| Pixel 8 (Chrome 113+) | Chrome | Full WebGPU, all models |
| Galaxy S23 (Samsung Int 27+) | Samsung Int | WebGPU, memory pressure |
| Low-end Android (4GB RAM) | Chrome | WASM fallback, slow performance |

### Test Checklist

- [ ] WebGPU detection works correctly
- [ ] Model download shows progress
- [ ] Streaming responses render properly
- [ ] Memory doesn't cause OOM crashes
- [ ] Cache API caching works across sessions
- [ ] Error messages are user-friendly
- [ ] Offline mode works after model download
- [ ] WASM loading works on non-secure contexts (localhost)
- [ ] Samsung Internet DevTools debugging works (when available)

## Browser DevTools for Debugging

### Chrome DevTools (Android)
- `chrome://gpu` — GPU feature status
- `chrome://inspect` — Remote debug Android Chrome
- Memory panel — Heap snapshots for OOM debugging
- `chrome://tracing` — Performance profiling

### Safari Web Inspector
- `Develop > Show JavaScript Console`
- `Develop > Simulator` — Test different devices
- Memory graph — Monitor memory over time

### Firefox DevTools
- `about:config` — Enable WebGPU flag
- Memory tool — Performance monitoring

### Samsung Internet
- No direct DevTools equivalent
- Use Chrome on Android for debugging (same Chromium engine)
- Test on Samsung Internet for real-world compatibility

## COEP/COOP Headers

Required for SharedArrayBuffer (multi-thread WASM), but wllama uses single-thread WASM so these headers are **not strictly required** for the current implementation. However, they're set in `vite.config.ts` for future compatibility:

```typescript
headers: {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
},
```

## Production Deployment Considerations

### HTTPS Required
- Cache API requires secure context (HTTPS or localhost)
- Model caching won't work on HTTP (except localhost)
- Model will download fresh each session on HTTP

### Model Hosting
- Current: HuggingFace CDN (huggingface.co)
- Alternative: Self-hosted model on S3/CloudFront
- Alternative: Bundle model with app (not recommended for 0.7GB+)

### Bandwidth
- First load: ~0.7GB download
- Subsequent loads: Cached (zero download)
- Cellular users: May need "download over WiFi only" option
