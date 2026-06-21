# AI Tool Builder - Documentation

> **Updated:** 2026-06-20
> **Current runtime:** wllama v3.5.1 (WASM/CPU) — live on mobile

## Documentation Index

### Architecture & Integration
- [`webllm-integration.md`](webllm-integration.md) — **wllama (WASM/CPU) integration guide** — model loading, caching, streaming chat, state management, error handling
- [`on-device-inference.md`](on-device-inference.md) — On-device LLM landscape: wllama vs WebLLM vs server-based, architecture comparison, fallback strategy
- [`edge_llm_research.md`](edge_llm_research.md) — Comprehensive research: LiteLLM, WebLLM, WebGPU, WASM, wllama, LangGraph, MCP, BitNet, and ecosystem overview

### Model & Browser Support
- [`model-compatibility.md`](model-compatibility.md) — Model selection for mobile browsers: GGUF format, quantization, device tiers, trusted sources
- [`mobile-browser-support.md`](mobile-browser-support.md) — Browser compatibility matrix: WASM/WebGPU support, feature detection, known issues, testing results

### Implementation Tracking
- [`IMPLEMENTATION_LOG.md`](IMPLEMENTATION_LOG.md) — Test results, lessons learned, device compatibility tracking, known issues

## Quick Reference

### Current Implementation
- **Runtime:** wllama v3.5.1 (WebAssembly, CPU inference)
- **Model:** Qwen2.5-1.5B-Instruct Q4_K_M (~0.7GB GGUF)
- **Cache:** Browser Cache API
- **Tested on:** Samsung Galaxy S21 FE (Chrome Android 149)
- **Status:** ✅ Live and tested

### Fallback Strategy
1. **Primary:** wllama WASM (CPU inference — works everywhere)
2. **Future:** WebLLM WebGPU (GPU acceleration — faster, WebGPU devices only)
3. **Future:** Server-based API (requires internet)

### Key Files
- `src/llm-engine.ts` — Core engine (loadModel, sendMessage, state)
- `src/model-cache.ts` — Cache API wrapper (download, cache, retrieve)
- `src/App.ts` — UI (Arrow.js components, reactive state)
- `vite.config.ts` — Dev server config (COEP/COOP headers, HTTPS)
