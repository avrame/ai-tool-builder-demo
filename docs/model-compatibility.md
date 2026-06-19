# Model Compatibility Guide

## Mobile Browser Model Selection

When running LLMs in mobile browsers, model choice is constrained by:
- Available RAM (4-12GB on mobile devices)
- GPU capability (WebGPU tier)
- IndexedDB storage limits (~50-100MB per model cache)
- Network bandwidth for initial download

### Recommended Models for Mobile

| Model | Params | Size (q4f16_1) | Min RAM | Min GPU | Speed (tok/s) | Best For |
|-------|--------|----------------|---------|---------|---------------|----------|
| Llama-3.2-1B-Instruct | 1.2B | ~0.7GB | 4GB | WebGPU Tier 1 | 20-30 | Fastest response, basic tasks |
| Qwen2.5-1.5B-Instruct | 1.5B | ~0.9GB | 4GB | WebGPU Tier 1 | 15-25 | Balanced speed/quality |
| SmolLM2-1.7B-Instruct | 1.7B | ~1.1GB | 6GB | WebGPU Tier 1 | 10-20 | Lightweight reasoning |
| Phi-3.5-mini-instruct | 3.8B | ~2.4GB | 8GB | WebGPU Tier 2 | 5-10 | Best quality, slower |

### Model Format Requirements

All models must be:
1. **Quantized to q4f16_1** — best speed/quality balance for WebGPU
2. **MLC-compatible** — converted via MLC AI's model compiler
3. **Instruct-tuned** — fine-tuned for chat/conversation use
4. **Under 3GB** — practical limit for mobile downloads on cellular

### Compatibility by Device Tier

#### High-End Mobile (iPhone 15+, Galaxy S24+)
- All listed models work
- Prefer: Qwen2.5-1.5B or Phi-3.5-mini for best quality
- Can hold 2-3 models cached simultaneously

#### Mid-Range Mobile (iPhone 12-14, Galaxy S21-23)
- Recommended: Llama-3.2-1B or Qwen2.5-1.5B
- Avoid: Phi-3.5-mini (may OOM or be unusably slow)
- Can hold 1-2 models cached

#### Low-End / Older Devices
- Recommended: Llama-3.2-1B only
- May need WASM fallback (no WebGPU)
- Single model cache only

### Model Selection Strategy

```typescript
// In send-message.ts, models are defined as:
export const MODEL_OPTIONS = [
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", name: "Qwen 2.5 1.5B", desc: "Good balance", size: "~0.9 GB" },
  { id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC", name: "SmolLM2 1.7B", desc: "Lightweight, fast", size: "~1.1 GB" },
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", name: "Llama 3.2 1B", desc: "Fastest inference", size: "~0.7 GB" },
  { id: "Phi-3.5-mini-instruct-q4f16_1-MLC", name: "Phi 3.5 Mini", desc: "Best quality (slower)", size: "~2.4 GB" },
] as const;
```

### Adding New Models

To add a new model:
1. Find an MLC-compatible model on the [MLC LLM model list](https://llm.mlc.ai/)
2. Verify it has a q4f16_1 quantized variant
3. Add to `MODEL_OPTIONS` in `src/send-message.ts`
4. Test on target devices for speed and memory usage
5. Update this document with measured performance

### Models to Avoid on Mobile

- **7B+ parameter models** — too large for mobile RAM
- **Non-instruct models** — poor conversational quality
- **fp16/bf16 (unquantized)** — 4-8x larger, minimal quality gain on mobile
- **Non-MLC formats** — WebLLM only supports MLC-compiled models
