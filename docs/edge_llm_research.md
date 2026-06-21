# Edge/Local LLM Technologies — Knowledge Base

> Updated: 2026-05-16
> Purpose: Reference for understanding the edge-local LLM ecosystem, key technologies, their maturity, and how they interrelate.

---

## 1. LiteLLM — Unified API Gateway / Proxy

### What It Is
LiteLLM is an open-source proxy and SDK that provides a **single, OpenAI-compatible interface** for calling 100+ LLM providers — both cloud (OpenAI, Anthropic, Azure, Google, Groq, Mistral, Cohere, etc.) and self-hosted (Ollama, vLLM, Llamafile, LM Studio, Xinference). It abstracts away provider-specific API differences, routing, and rate-limiting.

### Maturity
**Production-ready.** Widely adopted in production. The proxy server supports authentication, rate limiting, cost tracking, latency monitoring, automatic failover, and request/response logging. SDK and proxy are actively maintained with a large contributor community (1,005+). Backed by Y Combinator.

### Key Metrics
- **240M+** Docker pulls
- **1B+** requests served
- **1,005+** contributors
- **$0** open-source core (full feature access)
- **80%** uptime (production SLA)

### Key Players / Libraries
- **LiteLLM** (Python SDK + Proxy server) — `pip install litellm`
- **LiteLLM Proxy** — standalone server on port 4000, drop-in replacement for OpenAI API
- **Alternative gateways:** Helicone, Portkey, Kong AI, TrueFoundry (more enterprise-focused)

### How It Fits
LiteLLM is the **orchestration layer** between applications and inference backends. It doesn't run models itself — it routes to them. For edge/local setups, it lets you point a single API endpoint at local backends (Ollama, vLLM, LM Studio) alongside cloud providers, with automatic fallback. It's the glue that makes local models usable in existing codebases without rewriting API calls.

### Notable Customers
- **Netflix:** Uses LiteLLM for "Day 0 LLM access" — enables rapid model rollout within 1 day of release, eliminates hours of manual input/output transformation per provider.
- **Lemonade:** Streamlined multi-model management with Langfuse observability.

### Limitations
- Adds latency (~300ms overhead per proxy hop)
- Proxy is a single point of failure in local setups
- Limited fine-grained model-level routing policies compared to enterprise gateways
- Doesn't handle model loading, quantization, or inference optimization

---

## 2. WebLLM — In-Browser LLM Inference

### What It Is
WebLLM is a high-performance JavaScript framework that runs LLMs **entirely in the browser** using WebGPU for hardware acceleration. It provides an OpenAI-style API, supports Web Workers to offload computation from the main thread, and works with models in MLC format (Llama, Phi, Gemma, Mistral, Qwen, and more).

### Maturity
**Active development, production-usable for smaller models.** Backed by MLC AI (Georgia Tech research spinoff). Academic paper published (arXiv:2412.15803). Chrome extension support exists. The reference chat app at chat.webllm.ai demonstrates real-time streaming inference. Supports Web Worker and Service Worker for offloading computation from the main thread.

### Key Players / Libraries
- **WebLLM** (npm: `web-llm`) — the main framework
- **MLC-LLM / Apache TVM** — ML compilers that convert models to optimized WebGPU kernels
- **WebLLM Chat** — reference web app at chat.webllm.ai
- Supported models: Llama, Phi, Gemma, Mistral, Qwen, RedPajama
- Full OpenAI API compatibility: JSON-mode, function-calling, streaming

### How It Fits
WebLLM is the **highest-level browser inference framework** — it abstracts away WebGPU complexity and provides a clean API. It sits on top of WebGPU and uses TVM-compiled kernels. For developers who want to embed an LLM in a web app with zero server infrastructure, this is the most mature option. It integrates with the UI layer via Shadow DOM for safe embedding into existing pages.

### Limitations
- Model sizes constrained by browser memory (~2-4GB VRAM typical)
- Performance depends heavily on client GPU (desktop GPUs > laptops > mobile)
- No support for very large models (70B+)
- Model conversion pipeline (MLC format) adds complexity
- Streaming and tool calling support is still evolving

---

## 3. WebGPU — Direct GPU Access from the Browser

### What It Is
WebGPU is the W3C standard for **direct, low-level GPU access** from JavaScript, replacing WebGL for both graphics and general-purpose compute. It maps to native APIs (Direct3D 12 on Windows, Metal on macOS, Vulkan on Linux/ChromeOS) and provides compute shaders, texture operations, and buffer management. It delivers 3x+ improvements in ML model inference compared to WebGL.

### Maturity
**Critical mass achieved (November 2025).** All four major browsers ship WebGPU by default — a milestone announced on November 25, 2025. This was the W3C GPU for the Web Working Group's biggest project reaching deployment target status. Apple added HDR images in WebGPU Canvas and, as of Safari 26.2, WebXR integration with WebGPU rendering on Vision Pro.

| Browser | Version | Platforms |
|---------|---------|-----------|
| Chrome/Edge | v113+ | Windows, macOS, ChromeOS |
| Firefox | v141+ | Windows; v145+ macOS ARM64 |
| Safari | v26+ | macOS Tahoe, iOS |
| Opera/Samsung Internet | Supported | — |

Mobile support is still maturing (Firefox on Android, Safari on older iOS).

### WebNN — Neural Network API on Top of WebGPU
WebNN is W3C's platform-neutral API for neural network inference, with backends for NPUs, GPUs, and CPUs. Instead of binding directly to CUDA or Metal, browsers map WebNN calls to native acceleration (DirectML on Windows, Core ML on macOS, NNAPI on Android, TFLite/XNNPACK on CPU). ONNX Runtime Web can use the WebNN execution provider when present. WebNN is the portable contract that keeps app code unchanged while the browser targets the best backend. Currently behind a flag in Chromium-based browsers. Transformers.js v4 is preparing WebNN support.

### Key Players / Libraries
- **W3C GPU for the Web Working Group** — specification body (Mozilla, Apple, Intel, Microsoft contributors)
- **Transformers.js** — Hugging Face's JS library with WebGPU backend, 100+ model architectures, v4 released with ONNX Runtime WebGPU warnings hidden by default and WebNN preparation underway. Enables running models entirely client-side with no backend server.
- **ONNX Runtime Web** — Microsoft's ONNX inference engine with WebGPU backend, supports WASM backend as fallback, and WebNN execution provider
- **WebNN** — emerging W3C standard for neural network primitives (Transformers.js is preparing WebNN support)
- **wllama** — community project porting llama.cpp to browser via WASM + WebGPU compute offload
- **TensorFlow.js** — with `@tensorflow/tfjs-backend-webgpu` for 3x faster inference vs WebGL
- **WebLLM** — highest-level framework built on WebGPU

### How It Fits
WebGPU is the **foundational compute layer** for all browser-based AI. WebLLM, Transformers.js, and ONNX Runtime Web all build on it. It's the bridge between JavaScript and the GPU, enabling ML inference that was previously impossible in the browser. WebNN is the next evolution — a higher-level API specifically for neural networks that will sit on top of WebGPU, abstracting backend selection into the browser.

### Limitations
- Mobile support is still maturing (especially Firefox on Android)
- No WebGPU on older browsers (Safari < 26, Firefox < 141)
- Compute API is complex — most developers use frameworks (WebLLM, Transformers.js) rather than raw WebGPU
- VRAM is shared with the OS and browser UI, limiting available memory for models
- No standard model format — each framework uses its own

---

## 4. WebAssembly (WASM) — Near-Native Performance in the Browser

### What It Is
WebAssembly is a binary instruction format for a stack-based virtual machine that runs at **near-native speed** in the browser. It enables C++, Rust, and other compiled languages to run in JavaScript environments. For LLM inference, WASM allows projects like llama.cpp to run quantized models directly in the browser without server-side processing.

### Maturity
**Production-usable for inference.** WASM 3.0 is in development with the Component Model, WasmGC for garbage collection, and WASI Preview 2. Over 30 programming languages compile to Wasm (Rust, C++, Python, Go). Benchmarks show Rust + WASM is 8-10x faster than pure JavaScript for compute-heavy tasks. Production deployments at Figma, Google, and Adobe demonstrate real-world viability. Docker+Wasm is in tech preview. WasmEdge (Spin) is a CNCF Sandbox project for serverless Wasm apps.

### Key Players / Libraries
- **llama.cpp WASM bindings** — ggml-org project, runs quantized GGUF models in browser
- **Emscripten** — C/C++ to WASM compiler, used by many inference projects
- **wasm32-wasi** — WASI (WebAssembly System Interface) for system-level access beyond the browser
- **WasmEdge (wasmedge)** — lightweight WASM runtime with WASI-NN support for LLM inference (PyTorch, TensorFlow, TensorFlow Lite, OpenVINO model formats)
- **ONNX Runtime Web** — supports WASM backend (with or without SIMD/multi-thread)
- **wasm-bindgen** — Rust-to-JS bridge (3-5x faster than pure JS; raw WASM exports: 8-10x)
- **Apache TVM / microTVM** — auto-scheduler for microcontrollers, cuts inference latency by 42% vs generic libraries
- **wasmCloud** — distributed ML/AI workloads with wasi-nn and wasi-webgpu support, uses Ollama API for inference

### How It Fits
WASM is the **alternative compute path** to WebGPU — it runs on the CPU rather than GPU, making it universally compatible but slower. It's the fallback when WebGPU isn't available, and in some cases (no discrete GPU, older hardware) it's the only option. WASM + WebGPU is a hybrid approach: WASM for the main inference loop, WebGPU for compute-heavy operations (attention). WasmEdge extends WASM beyond the browser to edge servers and embedded devices.

### Limitations
- No direct GPU access (WebGPU is needed for hardware acceleration)
- WASM SIMD support is still rolling out across browsers
- Memory overhead from data copying between JS and WASM (wasm-bindgen)
- No filesystem access in browser context (WASI provides it outside browsers)
- Model loading is slower than native (serialization overhead)

---

## 5. LangGraph / LangChain.js — Multi-Step Agentic Workflows

### What It Is
LangGraph is a framework for building **graph-based, deterministic AI workflows** where LLMs make decisions, call tools, and follow structured execution paths. LangChain.js is the JavaScript/TypeScript port of LangChain, enabling the same patterns in Node.js and browser environments. LangGraph 1.0 was released in October 2025 as the first stable major release.

### Maturity
**LangGraph (Python): Production-ready (v1.0, Oct 2025). LangChain.js: Active but less mature.** LangGraph provides durable state management, checkpointing, and human-in-the-loop capabilities. LangChain.js supports local model integration via Ollama, vLLM, and OpenAI-compatible endpoints. LangGraph.js brings graph-based orchestration to JS/TS — instead of linear chains, you define agent logic as nodes and edges.

### Key Players / Libraries
- **LangGraph** (Python) — `langgraph` package, graph-based agent orchestration
- **LangChain.js** — `@langchain/langgraph`, `@langchain/ollama`, `@langchain/core`
- **Ollama integration** — `@langchain/ollama` for local model access
- **LangSmith** — observability, evaluation, and deployment platform
- **Local backends:** Ollama, vLLM, LM Studio (all expose OpenAI-compatible APIs)
- **Competitors:** CrewAI, OpenAI Agents SDK, VoltAgent (TypeScript)

### How It Fits
LangGraph/LangChain.js is the **workflow orchestration layer** on top of inference backends. They don't run models — they manage multi-step reasoning, tool calling, memory, and state. For local setups, they connect to Ollama or vLLM via OpenAI-compatible API and add agentic capabilities (planning, tool use, multi-step reasoning). LangChain.js is the bridge for JavaScript-based local agents.

### Limitations
- LangChain.js is significantly less mature than the Python version
- Adds complexity for simple use cases (direct API calls often suffice)
- State management and checkpointing are Python-centric
- Heavy dependency tree in JS ecosystem
- Local model performance is bottlenecked by the inference backend, not the framework

---

## 6. Shadow DOM / Virtual DOM — Encapsulated UI for AI Overlays

### What It Is
**Shadow DOM** is a web standard (part of Web Components) that creates an isolated, encapsulated DOM subtree attached to an element. Styles and scripts inside a Shadow DOM are scoped exclusively to that tree — they cannot leak out or be affected by the host page. This is critical for embedding AI agents (chat widgets, side panels, voice assistants) into existing web pages without breaking the page's layout or styles.

### Maturity
**Web standard, widely supported.** Shadow DOM is part of the Web Components spec and supported in all modern browsers. It's the foundation for web components used in enterprise AI overlays. Microsoft Power Automate added Shadow DOM support in 2025, including nested shadow tree traversal and advanced selectors for automated interaction.

### Key Players / Libraries
- **Native Shadow DOM** — `element.attachShadow({ mode: 'open'|'closed' })`
- **Web Components standard** — Custom Elements + Shadow DOM + HTML Templates + ES Modules
- **Lit** — lightweight web component framework from Google
- **Angular / React / Vue** — all support Shadow DOM mode for encapsulated components
- **Microsoft Power Automate** — added Shadow DOM support for automating modern web apps (2025), including nested shadow trees
- **Imperva** — application security guidance for Shadow DOM usage and XSS prevention

### How It Fits
Shadow DOM is the **UI safety layer** for embedding AI in existing web pages. When you build a browser-based AI assistant (like WebLLM Chat or a custom overlay), Shadow DOM ensures the AI's styles, scripts, and DOM manipulations don't break the host page. It's the complement to the compute layers (WebGPU/WASM) — while those handle inference, Shadow DOM handles safe rendering.

### Security Considerations
- **Information leakage:** Shadow DOM can prevent the host page from accessing AI-generated content (good for security, bad for integration)
- **CSS isolation:** Prevents style conflicts but also prevents the host page from styling AI components
- **Cross-origin risks:** Shadow DOM doesn't prevent XSS from the host page — the AI component must still sanitize all inputs
- **Accessibility:** Screen readers can access Shadow DOM content, but some ARIA patterns require careful implementation

### Limitations
- Not all tools/frameworks handle Shadow DOM well (testing, automation, SSR)
- CSS isolation means the AI component looks different from the host page unless styles are explicitly shared
- `mode: 'closed'` prevents even the defining script from accessing the shadow root (anti-pattern)
- Nested Shadow DOM traversal is complex

---

## 7. BitNet / 1.58-bit Quantization — Ultra-Low-Bit Model Compression

### What It Is
**BitNet b1.58** is a quantization-aware training approach (from Microsoft Research) that discretizes every weight to one of three values: {-1, 0, +1}. Each parameter stores log₂(3) ≈ 1.58 bits. This is fundamentally different from traditional post-training quantization (PTQ) — BitNet models are **trained from scratch** (or fine-tuned) in ternary format, not converted from FP16 models.

### Maturity
**Research-to-production transition.** Microsoft released BitNet b1.58 2B4T (2B parameters, 4T training tokens) in 2025 with performance competitive with full-precision models. The official inference framework is available on GitHub (microsoft/BitNet). Fine-tuning existing models to 1.58-bit has been demonstrated (Llama3 8B fine-tuned on 10B tokens).

### Quantization Comparison

| Method | Bits | Approach | Speedup | Quality Loss | Best For |
|--------|------|----------|---------|--------------|----------|
| FP16 | 16 | Baseline | 1x | None | Reference |
| GPTQ | 4 | Post-training (layer-by-layer optimization) | ~3-4x | Low | GPU inference |
| AWQ | 4 | Post-training (activation-aware weight selection) | ~3-4x | Low | Latency-sensitive apps |
| GGUF (Q4_0) | 4 | Post-training (GGML format) | ~3-4x | Low | CPU/GPU universal |
| AQLM | 2-4 | Post-training (advanced quantization) | ~5-8x | Moderate | Edge deployment |
| BitNet b1.58 | 1.58 | Training-aware (ternary) | ~10x | Very low (large models) | Edge/mobile, CPU |

### Key Players / Libraries
- **Microsoft BitNet** — official inference framework (GitHub: microsoft/BitNet), optimized kernels for CPU and GPU
- **GGUF (llama.cpp)** — supports 1-bit/2-bit quantization via GGUQ format
- **GPTQ** — post-training quantization to 4-bit (AutoGPTQ, transformers library)
- **AWQ** — Activation-aware Weight Quantization, 4-bit, protects salient weights based on activation patterns
- **AQLM** — Advanced Quantization, supports 2-bit and 4-bit

### How It Fits
BitNet is the **most aggressive compression technique** in the ecosystem. While GPTQ/AWQ/GGUF reduce models to 4-bit (75% memory reduction), BitNet pushes to ~1.58 bits (90%+ memory reduction). One benchmark showed a 1.58-bit model achieving a 77.3% reduction in total memory usage compared to FP16 with only a 0.39 percentage point drop in WER. This enables running larger models or longer sequences on memory-constrained edge devices. BitNet is complementary to the other quantization methods — it's a training paradigm, not a post-training conversion.

### Limitations
- Requires training from scratch or extensive fine-tuning (can't convert existing models easily)
- Only competitive at larger model sizes (2B+ parameters)
- Hardware support is still maturing (optimized kernels for ternary operations)
- Smaller models (< 1B) lose more quality at 1.58-bit
- Ecosystem tooling (fine-tuning, evaluation) is less mature than 4-bit methods

---

## 8. MCP (Model Context Protocol) — Standardizing Model-Tool Communication

### What It Is
MCP is an **open standard** (introduced by Anthropic in November 2024) for connecting AI models to external tools and data sources. It defines a uniform, model-agnostic interface for how LLMs discover, call, and receive results from tools — filesystems, databases, APIs, and other local applications. It's the "USB-C for AI agents."

### Maturity
**Rapidly maturing.** June 2025 spec was the first stable model. November 2025 release (first anniversary) added security, enterprise features, authorization extensions, and agentic server support. **Governance transitioned to the Agentic AI Foundation under the Linux Foundation in late 2025.** SDK downloads grew from 100K (Nov 2024) to 97M+ monthly (2026). The 2026 roadmap includes: remote servers, stateless HTTP for hyperscale, triggers, streaming, skills, and SDK v2 for Python & TypeScript.

**June 2025 Spec Update:** Added OAuth 2.0 Resource Server Classification (RFC9728), Resource Indicators (RFC 8707) to prevent token misuse, and structured tool output (replacing unstructured text responses). JSON-RPC 2.0 batching was removed from the spec.

### Key Players / Libraries
- **Reference implementation** — modelcontextprotocol/sdk (TypeScript, Python)
- **MCP Inspector** — debugging and testing tool for MCP servers
- **MCP specification** — modelcontextprotocol.io/specification
- **Authorization Extensions** — enterprise-grade access control (Nov 2025)
- **Agentic Servers** — servers that can sample from models and call tools (Nov 2025)
- **LocalAI** — self-hosted OpenAI-compatible API that now supports MCP, enabling local models to connect to MCP servers for real-time data, APIs, and specialized tools
- **Client ecosystem:** Claude, ChatGPT, VS Code, Cursor, MCPJam, and many others
- **Community:** Discord + GitHub contributor communities, MCP Night events

### Architecture
```
[AI Agent] ←→ [MCP Client] ←→ [MCP Transport (stdio/SSE)] ←→ [MCP Server] ←→ [Local Tool/Data]
```

- **MCP Servers** expose tools, resources, and prompts to the model
- **MCP Clients** connect agents to servers
- **Transport:** stdio (local), SSE (network), or custom
- **Extensions:** Authorization, sampling, agentic capabilities

### How It Fits
MCP is the **standardization layer** for how local models interact with the environment. Without MCP, every AI agent needs custom integrations for every tool it might use. With MCP, an agent connects to one protocol and gets access to any MCP server (filesystem, database, API, browser, etc.). For local setups, MCP enables a local model (via Ollama, vLLM, or WebLLM) to interact with the user's files, databases, and tools through a standardized interface.

### Limitations
- Still young — many edge cases unaddressed
- Server quality varies widely across the ecosystem
- Security model is still evolving (authorization extensions are new)
- No native browser support for MCP servers (requires a bridge)
- Learning curve for building custom MCP servers

---

## Ecosystem Overview — How It All Fits Together

```
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
│  LangChain.js / LangGraph  │  Custom AI Apps  │  MCP Clients    │
├─────────────────────────────────────────────────────────────────┤
│                    ORCHESTRATION LAYER                          │
│  LiteLLM Proxy  │  MCP Protocol  │  Tool Routing  │  State Mgmt │
├─────────────────────────────────────────────────────────────────┤
│                   INFERENCE BACKENDS                            │
│  Ollama  │  vLLM  │  LM Studio  │  Xinference  │  llama.cpp    │
├─────────────────────────────────────────────────────────────────┤
│                 QUANTIZATION / COMPRESSION                      │
│  GGUF  │  GPTQ  │  AWQ  │  BitNet 1.58  │  AQLM               │
├─────────────────────────────────────────────────────────────────┤
│              COMPUTE RUNTIMES (Browser)                         │
│  WebGPU  │  WebAssembly (WASM)  │  WebNN (emerging)           │
├─────────────────────────────────────────────────────────────────┤
│              INFERENCE FRAMEWORKS (Browser)                     │
│  WebLLM  │  Transformers.js  │  ONNX Runtime Web  │  wllama     │
├─────────────────────────────────────────────────────────────────┤
│                    UI / ISOLATION                               │
│  Shadow DOM  │  Web Components  │  Virtual DOM Frameworks       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Relationships

- **LiteLLM** routes requests to **inference backends** (Ollama, vLLM) or browser frameworks (WebLLM)
- **WebLLM** and **Transformers.js** run on **WebGPU** (with **WASM** as fallback)
- **WASM** can also run **llama.cpp** directly in the browser, bypassing WebGPU
- **WebNN** sits between WebGPU and inference frameworks, abstracting backend selection
- **LangGraph/LangChain.js** orchestrate multi-step workflows on top of any inference backend
- **MCP** standardizes how agents connect to tools, regardless of the inference backend
- **BitNet/GGUF/GPTQ/AWQ** are quantization formats that feed into inference backends
- **Shadow DOM** encapsulates the UI layer of browser-based AI (WebLLM Chat, custom overlays)

### Recommended Stacks by Use Case

| Use Case | Stack |
|----------|-------|
| Local desktop AI assistant | Ollama → LiteLLM → LangGraph → MCP |
| Browser-based AI widget | WebLLM + Shadow DOM |
| Edge/mobile inference | BitNet 1.58 + WASM + WebGPU |
| Multi-provider orchestration | LiteLLM Proxy → Ollama/vLLM + MCP |
| Full browser AI (no server) | WebLLM + Transformers.js + Shadow DOM |
| Serverless edge AI | WasmEdge + WASI-NN + GGUF |

---

---

## 9. wllama — llama.cpp in the Browser (WASM/CPU)

### What It Is
**wllama** is a community project that ports llama.cpp to WebAssembly, enabling LLM inference directly in the browser using **CPU-based WASM execution** (no WebGPU required). It uses the standard **GGUF model format**, meaning any HuggingFace GGUF model can be loaded without conversion. This is the runtime used in the AI Tool Builder project.

### Maturity
**Production-usable for small models on CPU.** Actively maintained with v3.5+ releases. Supports streaming chat completions, GGUF models, and works on any browser with WASM support. The project is simpler than WebLLM (no MLC conversion pipeline) but slower (CPU only, 2-8 tok/s on mobile vs 15-30 tok/s with WebGPU).

### Key Players / Libraries
- **wllama** (npm: `@wllama/wllama`) — the main WASM runtime
- **llama.cpp** — the C++ inference engine that wllama ports
- **GGUF format** — standard model format (no conversion needed)
- **HuggingFace GGUF models** — bartowski, TheBloke, and others provide verified GGUFs
- **Cache API** — used for model caching in the browser

### How It Fits
wllama is the **universal compatibility path** for browser-based LLM inference. Unlike WebLLM (which requires WebGPU), wllama works on any browser with WASM support — including older devices, Samsung Internet, and any browser where WebGPU is disabled or unavailable. It's the fallback when WebGPU isn't available, and in some cases (no discrete GPU, older hardware) it's the only option. For the AI Tool Builder, wllama is the **primary runtime** because it ensures the app works on all mobile browsers without requiring WebGPU.

### Limitations
- CPU-only inference (2-8 tok/s on mobile, vs 15-30 tok/s with WebGPU)
- No GPU acceleration (WebGPU is needed for hardware acceleration)
- Memory overhead from data copying between JS and WASM
- Model loading is slower than native (serialization overhead)
- Single-threaded WASM (multi-thread requires SharedArrayBuffer + COEP/COOP headers)

### Real-World Results (AI Tool Builder)

| Metric | Value |
|--------|-------|
| Device | Samsung Galaxy S21 FE (Adreno 670, 8GB RAM) |
| Browser | Chrome 149 (Android) |
| Model | Qwen2.5-1.5B-Instruct Q4_K_M |
| Model Size | ~0.7 GB |
| Download Time (WiFi) | ~30-60 seconds |
| Model Load Time | ~15-30 seconds |
| Inference Speed | 2-8 tokens/sec (CPU) |
| Response Time (50 tokens) | ~10-25 seconds |
| Memory Usage | ~1.5-2.5 GB RAM |
| Context Window | 1024 tokens (low-RAM device) |
| Status | ✅ Live and tested |

### Architecture

```
Browser (Chrome/Samsung Internet)
  └── WebAssembly (wllama.wasm)
        └── GGUF Model (Qwen2.5-1.5B-Instruct Q4_K_M)
              └── Streaming chat completion (CPU inference)
```

### Key Implementation Details

1. **NoOpStorageBackend workaround** — wllama's default CacheManager requires OPFS (unavailable on Chrome Android with COEP/COOP headers). We supply a dummy backend since we handle caching via the Cache API.

2. **Cache API for model storage** — Models are cached in the browser's Cache API (not OPFS), which works in secure contexts (HTTPS or localhost).

3. **Device-aware configuration** — Thread count and context window are adjusted based on `navigator.deviceMemory`:
   - Low-RAM (≤4GB): 1024 token context, 2-4 threads
   - High-RAM (>4GB): 2048 token context, 2-4 threads

4. **Progress tracking** — Real-time progress updates during download and model loading.

5. **Error handling** — WASM loading failures, empty responses, and model cleanup on error.

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

---

*End of research document.*
