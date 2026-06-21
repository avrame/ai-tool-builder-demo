import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkWebGPUSupport,
  checkCachedModels,
  resetEngineState,
  engineState,
  messagesState,
  getCachedModelBlob,
  cacheModelBlob,
} from '../src/send-message';

describe('engineState / messagesState', () => {
  beforeEach(() => {
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
  it('returns cached model IDs when model blob exists', async () => {
    const testBlob = new Blob(['model data'], { type: 'application/octet-stream' });
    const mockResponse = {
      blob: vi.fn().mockResolvedValue(testBlob),
    };

    const mockCache = {
      open: vi.fn().mockResolvedValue({
        match: vi.fn().mockResolvedValue(mockResponse),
      }),
    };

    Object.defineProperty(globalThis, 'caches', {
      value: mockCache,
      writable: true,
      configurable: true,
    });

    const result = await checkCachedModels();
    expect(result).toContain('qwen2.5-1.5b-instruct');
    expect(result).toHaveLength(1);
    expect(engineState.cachedModels).toEqual(result);
  });

  it('returns empty array when no cached model exists', async () => {
    const mockCache = {
      open: vi.fn().mockResolvedValue({
        match: vi.fn().mockResolvedValue(null),
      }),
    };

    Object.defineProperty(globalThis, 'caches', {
      value: mockCache,
      writable: true,
      configurable: true,
    });

    const result = await checkCachedModels();
    expect(result).toEqual([]);
    expect(engineState.cachedModels).toEqual([]);
  });

  it('returns empty array on error', async () => {
    Object.defineProperty(globalThis, 'caches', {
      value: {
        open: vi.fn().mockRejectedValue(new Error('Cache error')),
      },
      writable: true,
      configurable: true,
    });

    const result = await checkCachedModels();
    expect(result).toEqual([]);
  });
});

describe('model-cache', () => {
  const CACHE_NAME = 'wllama-models-v1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCachedModelBlob', () => {
    it('returns null when cache is not available', async () => {
      Object.defineProperty(globalThis, 'caches', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = await getCachedModelBlob();
      expect(result).toBeNull();
    });

    it('returns null when no cached model exists', async () => {
      const mockCache = {
        open: vi.fn().mockResolvedValue({
          match: vi.fn().mockResolvedValue(null),
        }),
      };

      Object.defineProperty(globalThis, 'caches', {
        value: mockCache,
        writable: true,
        configurable: true,
      });

      const result = await getCachedModelBlob();
      expect(result).toBeNull();
      expect(mockCache.open).toHaveBeenCalledWith(CACHE_NAME);
    });

    it('returns cached blob when model exists in cache', async () => {
      const testBlob = new Blob(['test model data'], { type: 'application/octet-stream' });
      const mockResponse = {
        blob: vi.fn().mockResolvedValue(testBlob),
      };

      const mockCache = {
        open: vi.fn().mockResolvedValue({
          match: vi.fn().mockResolvedValue(mockResponse),
        }),
      };

      Object.defineProperty(globalThis, 'caches', {
        value: mockCache,
        writable: true,
        configurable: true,
      });

      const result = await getCachedModelBlob();
      expect(result).toBe(testBlob);
      expect(mockCache.open).toHaveBeenCalledWith(CACHE_NAME);
    });

    it('returns null on cache error', async () => {
      const mockCache = {
        open: vi.fn().mockRejectedValue(new Error('Cache error')),
      };

      Object.defineProperty(globalThis, 'caches', {
        value: mockCache,
        writable: true,
        configurable: true,
      });

      const result = await getCachedModelBlob();
      expect(result).toBeNull();
    });
  });

  describe('cacheModelBlob', () => {
    it('stores blob in cache', async () => {
      const testBlob = new Blob(['test data'], { type: 'application/octet-stream' });
      const mockPut = vi.fn().mockResolvedValue(undefined);

      const mockCache = {
        open: vi.fn().mockResolvedValue({
          put: mockPut,
        }),
      };

      Object.defineProperty(globalThis, 'caches', {
        value: mockCache,
        writable: true,
        configurable: true,
      });

      await cacheModelBlob(testBlob);
      expect(mockPut).toHaveBeenCalled();
      const putRequest = mockPut.mock.calls[0][1];
      expect(putRequest).toBeInstanceOf(Response);
    });

    it('uses correct cache name', async () => {
      const testBlob = new Blob(['test data']);
      const mockOpen = vi.fn().mockResolvedValue({
        put: vi.fn().mockResolvedValue(undefined),
      });

      Object.defineProperty(globalThis, 'caches', {
        value: {
          open: mockOpen,
        },
        writable: true,
        configurable: true,
      });

      await cacheModelBlob(testBlob);
      expect(mockOpen).toHaveBeenCalledWith(CACHE_NAME);
    });
  });
});
