# WebLLM Integration Guide

## Overview

WebLLM (by MLC AI) enables LLM inference directly in the browser using WebGPU. No server, no API keys, fully offline after initial model download.

## Key Concepts

### Engine

The `Engine` is the core WebLLM object that handles model loading, inference, and streaming.

```typescript
import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("model-id", {
  initProgressCallback: (report) => {
    console.log(report.text);
  },
});
```

### Model IDs

WebLLM uses model IDs from the HuggingFace model list. Examples:
- `"Llama-3.2-1B-Instruct-q4f16_1-MLC"` — Meta's small model
- `"Phi-3.5-mini-instruct-q4f16_1-MLC"` — Microsoft's model
- `"Qwen2.5-1.5B-Instruct-q4f16_1-MLC"` — Alibaba's model
- `"SmolLM2-1.7B-Instruct-q4f16_1-MLC"` — HuggingFace's small model

### Chat Completion API

WebLLM provides an OpenAI-compatible chat completion interface:

```typescript
const chunks = await engine.chat.completions.create({
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" },
  ],
  stream: true,
  max_tokens: 512,
});

for await (const chunk of chunks) {
  const content = chunk.choices[0]?.delta?.content || "";
  console.log(content);
}
```

### Preloading Models

For better UX, preload models before the user interacts:

```typescript
await engine.reload("another-model-id");
```

### Memory Management

- Models are cached in IndexedDB after first download
- Each model download is ~2-4GB for q4 quantized models
- Mobile devices need ~4GB RAM minimum for 1-3B models
- Use smaller models (1B-3B) for mobile

## Integration with Arrow.js

### State Management

Use Arrow.js `reactive()` to track engine state:

```typescript
import { reactive } from "@arrow-js/core";

export const engineState = reactive({
  engine: null as Engine | null,
  status: "idle" as "idle" | "loading" | "ready" | "error",
  error: "" as string,
  progress: 0 as number,
  progressText: "" as string,
});
```

### Loading Flow

1. Check WebGPU support on page load
2. Show model selection UI
3. Load selected model with progress callbacks
4. Store engine in reactive state
5. On chat, use engine.chat.completions.create()
6. Stream response into messages state

### Error Handling

- WebGPU not supported: Show fallback message
- Model download fails: Retry with exponential backoff
- Out of memory: Suggest smaller model
- Network timeout: Model download failed

## Performance Considerations

### Mobile Performance

| Model | Params | Size (q4) | Mobile Speed |
|-------|--------|-----------|--------------|
| SmolLM2-1.7B | 1.7B | ~1.1GB | 10-20 tok/s |
| Qwen2.5-1.5B | 1.5B | ~0.9GB | 15-25 tok/s |
| Phi-3.5-mini | 3.8B | ~2.4GB | 5-10 tok/s |
| Llama-3.2-1B | 1.2B | ~0.7GB | 20-30 tok/s |

### Optimization Tips

1. Use q4f16_1 quantization (best speed/quality balance)
2. Set `max_tokens` to reasonable limits (256-512)
3. Preload models during idle time
4. Cache models aggressively (IndexedDB)
5. Use `top_p` and `temperature` for response control

## Security

- All inference runs locally — no data leaves the device
- No network calls for inference (only model downloads)
- Sandboxed in browser context
- Can run fully offline after download
