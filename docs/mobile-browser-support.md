# Mobile Browser Support

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
| Chrome (Android) | 113+ | Yes | Stable | Best mobile support |
| Samsung Internet | 27+ | Yes | Stable | Chromium-based, good WebGPU |
| Firefox (Android) | 121+ | Yes | Stable | May need `about:config` flags |
| Safari (iOS) | 17.4+ | Yes | Stable | iOS 17.4+ required |
| Safari (iPadOS) | 17.4+ | Yes | Stable | iPadOS 17.4+ required |
| Edge (Android) | 113+ | Yes | Stable | Chromium-based |
| Brave | Based on Chromium | Yes | Varies | Depends on Chromium version |

### Browsers Without WebGPU Support

| Browser | Reason | Fallback |
|---------|--------|----------|
| iOS Safari < 17.4 | Apple hasn't enabled WebGPU | Show error message |
| Firefox (iOS) | Uses WebKit engine, limited | Show error message |
| Opera Mini | Compressed proxy, no GPU | Server-based fallback |
| UC Browser | Limited GPU access | Server-based fallback |

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

## Known Issues and Workarounds

### Chrome Android — WebGPU Disabled on Low-End Devices
- **Symptom:** `navigator.gpu` exists but `requestAdapter()` returns null
- **Cause:** Chrome disables WebGPU on devices with < 4GB RAM
- **Workaround:** Show error message suggesting a smaller model or server fallback

### Firefox Android — WebGPU Behind Flag
- **Symptom:** WebGPU not available even on supported versions
- **Cause:** Must enable `dom.webgpu.enabled` in `about:config`
- **Workaround:** Show user-friendly message with instructions to enable

### iOS Safari — WebGPU Limited to A12+ Chips
- **Symptom:** WebGPU works but performance varies widely
- **Cause:** Neural Engine only on A12+ (iPhone XS+)
- **Workaround:** Recommend Llama-3.2-1B or Qwen2.5-1.5B for older devices

### Samsung Internet — Memory Pressure
- **Symptom:** App crashes when loading models > 1.5GB
- **Cause:** Samsung Internet has stricter memory limits than Chrome
- **Workaround:** Pre-load smaller models, clear cache between sessions

## Browser Fallback Strategy

```
1. Check WebGPU support → if yes, use WebLLM (on-device)
2. If no WebGPU → check if online → if yes, use server-based API
3. If no server → show error message with model recommendations
```

### Implementation in `entry-client.ts`

```typescript
// checkWebGPUSupport() is called on app load (non-blocking)
// If false, engineState.webgpuSupported = false
// App renders with warning banner (see App.ts)
```

## Testing on Real Devices

### Recommended Test Devices

| Device | Browser | What to Test |
|--------|---------|-------------|
| iPhone 15 (iOS 17.4+) | Safari | Full WebGPU, all models |
| iPhone 12 (iOS 17.4+) | Safari | WebGPU, memory limits |
| Pixel 8 (Chrome 113+) | Chrome | Full WebGPU, all models |
| Galaxy S23 (Samsung Int 27+) | Samsung Int | WebGPU, memory pressure |
| Low-end Android (4GB RAM) | Chrome | Adapter null, fallback |

### Test Checklist

- [ ] WebGPU detection works correctly
- [ ] Model download shows progress
- [ ] Streaming responses render properly
- [ ] Memory doesn't cause OOM crashes
- [ ] IndexedDB caching works across sessions
- [ ] Error messages are user-friendly
- [ ] Offline mode works after model download

## Browser DevTools for Debugging

### Chrome DevTools
- `chrome://gpu` — GPU feature status
- `chrome://inspect` — Remote debug Android Chrome
- Memory panel — Heap snapshots for OOM debugging

### Safari Web Inspector
- `Develop > Show JavaScript Console`
- `Develop > Simulator` — Test different devices
- Memory graph — Monitor memory over time

### Firefox DevTools
- `about:config` — Enable WebGPU flag
- Memory tool — Performance monitoring
