# Model Compatibility Guide

> **Updated:** 2026-06-20
> **Current runtime:** wllama v3.5.1 (WASM/CPU)
> **Model format:** GGUF (standard)

## Mobile Browser Model Selection

When running LLMs in mobile browsers, model choice is constrained by:
- Available RAM (4-12GB on mobile devices)
- CPU capability (WASM inference speed)
- Cache API storage limits (~1GB per model)
- Network bandwidth for initial download

### Current Implementation

**Model:** Qwen2.5-1.5B-Instruct Q4_K_M
- **Format:** GGUF (standard, no conversion needed)
- **Size:** ~0.7 GB
- **Source:** HuggingFace (bartowski/Qwen2.5-1.5B-Instruct-GGUF)
- **Runtime:** wllama WASM (CPU inference)
- **Speed:** 2-8 tokens/sec on mobile

### Recommended Models for Mobile (wllama/GGUF)

| Model | Params | Size (Q4_K_M) | Min RAM | Min CPU | Speed (tok/s) | Best For |
|-------|--------|---------------|---------|---------|---------------|----------|
| Qwen2.5-1.5B-Instruct | 1.5B | ~0.7GB | 4GB | Dual-core | 2-8 | Balanced speed/quality |
| Llama-3.2-1B-Instruct | 1.2B | ~0.6GB | 4GB | Dual-core | 3-10 | Fastest response, basic tasks |
| SmolLM2-1.7B-Instruct | 1.7B | ~0.9GB | 6GB | Quad-core | 1-6 | Lightweight reasoning |
| Phi-3.5-mini-instruct | 3.8B | ~2.0GB | 8GB | Quad-core | 0.5-3 | Best quality, slow |

### Model Format Requirements

All models must be:
1. **Quantized to Q4_K_M or Q4_0** — best speed/quality balance for WASM
2. **GGUF format** — standard format, no conversion needed
3. **Instruct-tuned** — fine-tuned for chat/conversation use
4. **Under 1GB** — practical limit for mobile downloads on cellular (wllama)
5. **From bartowski or similar trusted source** — verified GGUF files

### Compatibility by Device Tier

#### High-End Mobile (iPhone 15+, Galaxy S24+)
- All listed models work
- Prefer: Qwen2.5-1.5B or Phi-3.5-mini for best quality
- Can hold 2-3 models cached simultaneously

#### Mid-Range Mobile (iPhone 12-14, Galaxy S21-23)
- Recommended: Qwen2.5-1.5B or Llama-3.2-1B
- Avoid: Phi-3.5-mini (may be unusably slow on CPU)
- Can hold 1-2 models cached

#### Low-End / Older Devices
- Recommended: Llama-3.2-1B only
- Expect: 1-3 tokens/sec
- Single model cache only

### Model Selection Strategy

```typescript
// In llm-engine.ts, models are defined as:
export const MODEL_OPTIONS = [
  {
    id: "qwen2.5-1.5b-instruct",
    name: "Qwen2.5 1.5B Instruct",
    desc: "Q4 quantized GGUF model via wllama (CPU/WASM)",
    size: "~0.7 GB",
  },
] as const;

// Model URL (HuggingFace)
export const MODEL_URL = "https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf";
```

### Adding New Models

To add a new model:
1. Find a GGUF model on HuggingFace (search for `GGUF` + `instruct`)
2. Verify it has a Q4_K_M or Q4_0 quantization
3. Update `MODEL_OPTIONS` in `src/llm-engine.ts`
4. Update `MODEL_URL` in `src/model-cache.ts`
5. Test on target devices for speed and memory usage
6. Update this document with measured performance

### Trusted GGUF Sources

- **bartowski** — https://huggingface.co/bartowski (verified, high-quality GGUFs)
- **TheBloke** — https://huggingface.co/TheBloke (legacy, many GGUFs available)
- **llama.cpp** — https://huggingface.co/ggml-org (official GGML/GGUF conversions)

### Models to Avoid on Mobile

- **7B+ parameter models** — too large for mobile RAM, unusably slow on CPU
- **Non-instruct models** — poor conversational quality
- **fp16/bf16 (unquantized)** — 4-8x larger, minimal quality gain on mobile
- **Non-GGUF formats** — wllama only supports GGUF
- **Models without Q4 quantization** — too large for mobile

### Quantization Comparison

| Method | Bits | Size Reduction | Speed | Quality | Best For |
|--------|------|---------------|-------|---------|----------|
| FP16 | 16 | 1x | 1x | Reference | Server only |
| Q4_K_M | 4 | ~4x | ~4x | Low loss | Mobile (recommended) |
| Q4_0 | 4 | ~4x | ~4x | Low loss | Mobile (simpler) |
| Q3_K_S | 3 | ~5x | ~5x | Moderate | Very low RAM |
| Q2_K | 2 | ~8x | ~8x | High loss | Emergency only |

### Performance by Quantization (Qwen2.5-1.5B, Galaxy S21 FE)

| Quantization | Size | Speed (tok/s) | Quality | Recommended |
|-------------|------|---------------|---------|-------------|
| Q4_K_M | ~0.7GB | 2-8 | Good | ✅ Yes |
| Q4_0 | ~0.7GB | 2-8 | Good | ✅ Yes |
| Q3_K_S | ~0.5GB | 3-10 | OK | For low-RAM |
| Q2_K | ~0.4GB | 4-12 | Poor | Only if needed |
