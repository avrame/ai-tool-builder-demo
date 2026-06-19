import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkWebGPUSupport, checkCachedModels, resetEngineState, engineState, messagesState } from '../src/send-message';

describe('engineState / messagesState', () => {
  beforeEach(() => {
    // Reset state before each test
    resetEngineState();
    messagesState.messages = [];
    messagesState.status = 'idle';
    messagesState.error = '';
  });

  describe('resetEngineState', () => {
    it('resets status to idle', () => {
      engineState.status = 'loading';
      resetEngineState();
      expect(engineState.status).toBe('idle');
    });

    it('clears error message', () => {
      engineState.error = 'Something went wrong';
      resetEngineState();
      expect(engineState.error).toBe('');
    });

    it('resets progress to 0', () => {
      engineState.progress = 50;
      resetEngineState();
      expect(engineState.progress).toBe(0);
    });

    it('clears progress text', () => {
      engineState.progressText = 'Loading...';
      resetEngineState();
      expect(engineState.progressText).toBe('');
    });
  });
});

describe('checkWebGPUSupport', () => {
  it('returns false when navigator.gpu is not available', async () => {
    const originalGpu = (globalThis as any).navigator?.gpu;
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    const result = await checkWebGPUSupport();
    expect(result).toBe(false);
    expect(engineState.webgpuSupported).toBe(false);

    // Restore
    if (originalGpu !== undefined) {
      (globalThis as any).navigator.gpu = originalGpu;
    }
  });

  it('returns false when requestAdapter returns null', async () => {
    (globalThis as any).navigator = {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue(null),
      },
    };

    const result = await checkWebGPUSupport();
    expect(result).toBe(false);
    expect(engineState.webgpuSupported).toBe(false);
  });

  it('returns true when adapter is available', async () => {
    (globalThis as any).navigator = {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue({ info: { getName: () => 'Test GPU' } }),
      },
    };

    const result = await checkWebGPUSupport();
    expect(result).toBe(true);
    expect(engineState.webgpuSupported).toBe(true);
  });

  it('returns false when requestAdapter throws', async () => {
    (globalThis as any).navigator = {
      gpu: {
        requestAdapter: vi.fn().mockRejectedValue(new Error('GPU error')),
      },
    };

    const result = await checkWebGPUSupport();
    expect(result).toBe(false);
    expect(engineState.webgpuSupported).toBe(false);
  });
});

describe('checkCachedModels', () => {
  it('returns empty array when indexedDB.databases is not available', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    const result = await checkCachedModels();
    expect(result).toEqual([]);
  });

  it('returns empty array when no cached models match', async () => {
    const mockDatabases = [
      { name: 'some-other-db', version: 1 },
      { name: 'another-db', version: 2 },
    ];

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        indexedDB: {
          databases: vi.fn().mockResolvedValue(mockDatabases),
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await checkCachedModels();
    expect(result).toEqual([]);
    expect(engineState.cachedModels).toEqual([]);
  });

  it('detects cached models by database name', async () => {
    const mockDatabases = [
      { name: 'mlc-ai---Qwen2.5-1.5B-Instruct-q4f16_1-MLC', version: 1 },
      { name: 'mlc-ai---SmolLM2-1.7B-Instruct-q4f16_1-MLC', version: 1 },
      { name: 'other-db', version: 1 },
    ];

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        indexedDB: {
          databases: vi.fn().mockResolvedValue(mockDatabases),
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await checkCachedModels();
    expect(result).toContain('Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
    expect(result).toContain('SmolLM2-1.7B-Instruct-q4f16_1-MLC');
    expect(result).not.toContain('Llama-3.2-1B-Instruct-q4f16_1-MLC');
    expect(engineState.cachedModels).toEqual(result);
  });

  it('handles database names without model ID gracefully', async () => {
    const mockDatabases = [
      { name: 'mlc-ai---UnknownModel', version: 1 },
    ];

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        indexedDB: {
          databases: vi.fn().mockResolvedValue(mockDatabases),
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await checkCachedModels();
    expect(result).toEqual([]);
  });

  it('returns empty array on error', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        indexedDB: {
          databases: vi.fn().mockRejectedValue(new Error('DB error')),
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await checkCachedModels();
    expect(result).toEqual([]);
  });
});
