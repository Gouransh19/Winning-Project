import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  WriteQueueService, 
  ConcurrencyService, 
  DEFAULT_CONCURRENCY_CONFIG,
  ConcurrencyMetrics
} from '../core/concurrency-service';
import { ChromeStorageService } from '../core/storage-service';
import { Prompt } from '../core/types';

// Simple in-memory fake for chrome.storage.local exposing get/set
class FakeChromeStorageLocal {
  store: Record<string, any> = {};
  get(keys: string[] | string, cb: (result: any) => void) {
    const res: any = {};
    if (Array.isArray(keys)) {
      for (const k of keys) res[k] = this.store[k];
    } else {
      res[keys] = this.store[keys];
    }
    setTimeout(() => cb(res), 0);
  }
  set(obj: Record<string, any>, cb: () => void) {
    Object.assign(this.store, obj);
    setTimeout(cb, 0);
  }
}

// attach a fake chrome global for ChromeStorageService to use
declare const global: any;

describe('WriteQueueService', () => {
  let writeQueue: WriteQueueService;

  beforeEach(() => {
    writeQueue = new WriteQueueService();
  });

  afterEach(() => {
    writeQueue.clear();
  });

  it('should execute operations in sequence', async () => {
    const results: number[] = [];
    
    const promises = [
      writeQueue.enqueue(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(1);
        return 1;
      }),
      writeQueue.enqueue(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        results.push(2);
        return 2;
      }),
      writeQueue.enqueue(async () => {
        results.push(3);
        return 3;
      })
    ];

    await Promise.all(promises);

    // Operations should execute in order despite different delays
    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle operation failures gracefully', async () => {
    const results: number[] = [];
    
    const promises = [
      writeQueue.enqueue(async () => {
        results.push(1);
        return 1;
      }),
      writeQueue.enqueue(async () => {
        throw new Error('Operation failed');
      }),
      writeQueue.enqueue(async () => {
        results.push(3);
        return 3;
      })
    ];

    const [result1, result2, result3] = await Promise.allSettled(promises);

    expect(result1.status).toBe('fulfilled');
    expect(result2.status).toBe('rejected');
    expect(result3.status).toBe('fulfilled');
    expect(results).toEqual([1, 3]); // Failed operation doesn't prevent others
  });

  it('should track queue depth correctly', async () => {
    expect(writeQueue.getQueueDepth()).toBe(0);

    const promise1 = writeQueue.enqueue(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 1;
    });

    // Queue depth should be 1 while processing
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(writeQueue.getQueueDepth()).toBe(0); // Should be processing

    const promise2 = writeQueue.enqueue(async () => 2);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(writeQueue.getQueueDepth()).toBe(1); // Should be queued

    await Promise.all([promise1, promise2]);
    expect(writeQueue.getQueueDepth()).toBe(0);
  });

  it('should provide accurate metrics', async () => {
    const metrics = writeQueue.getMetrics();
    expect(metrics.totalOperations).toBe(0);

    await writeQueue.enqueue(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 1;
    });
    await writeQueue.enqueue(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 2;
    });

    const updatedMetrics = writeQueue.getMetrics();
    expect(updatedMetrics.totalOperations).toBe(2);
    expect(updatedMetrics.successfulOperations).toBe(2);
    expect(updatedMetrics.failedOperations).toBe(0);
    expect(updatedMetrics.averageLatency).toBeGreaterThanOrEqual(0);
  });
});

describe('ConcurrencyService', () => {
  let writeQueue: WriteQueueService;
  let concurrencyService: ConcurrencyService;

  beforeEach(() => {
    writeQueue = new WriteQueueService();
    concurrencyService = new ConcurrencyService(writeQueue, {
      ...DEFAULT_CONCURRENCY_CONFIG,
      logOperations: false
    });
  });

  afterEach(() => {
    writeQueue.clear();
    concurrencyService.resetMetrics();
  });

  it('should execute operations atomically', async () => {
    let counter = 0;
    
    const promises = Array.from({ length: 10 }, () =>
      concurrencyService.executeAtomic(async () => {
        const current = counter;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        counter = current + 1;
        return counter;
      })
    );

    await Promise.all(promises);
    expect(counter).toBe(10);
  });

  it('should retry failed operations', async () => {
    let attemptCount = 0;
    
    const result = await concurrencyService.executeWithRetry(async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    }, 3);

    expect(result).toBe('success');
    expect(attemptCount).toBe(3);
  });

  it('should fail after max retries', async () => {
    let attemptCount = 0;
    
    await expect(
      concurrencyService.executeWithRetry(async () => {
        attemptCount++;
        throw new Error('Permanent failure');
      }, 2)
    ).rejects.toThrow('Operation failed after 2 attempts');

    expect(attemptCount).toBe(2);
  });

  it('should combine atomic execution with retry logic', async () => {
    let counter = 0;
    let attemptCount = 0;
    
    const promises = Array.from({ length: 5 }, () =>
      concurrencyService.executeAtomicWithRetry(async () => {
        attemptCount++;
        if (attemptCount % 3 === 0) {
          throw new Error('Random failure');
        }
        const current = counter;
        await new Promise(resolve => setTimeout(resolve, 5));
        counter = current + 1;
        return counter;
      }, 2)
    );

    await Promise.all(promises);
    expect(counter).toBe(5);
  });

  it('should provide comprehensive metrics', async () => {
    // Execute some operations
    await concurrencyService.executeAtomic(async () => 1);
    await concurrencyService.executeWithRetry(async () => 2);
    
    // Force a failure
    try {
      await concurrencyService.executeWithRetry(async () => {
        throw new Error('Test failure');
      }, 1);
    } catch (e) {
      // Expected
    }

    const metrics = concurrencyService.getMetrics();
    expect(metrics.totalOperations).toBeGreaterThan(0);
    expect(metrics.successfulOperations).toBeGreaterThan(0);
    expect(metrics.failedOperations).toBeGreaterThan(0);
    expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
  });
});

describe('ChromeStorageService Concurrency', () => {
  let fakeStorage: FakeChromeStorageLocal;
  let writeQueue: WriteQueueService;
  let concurrencyService: ConcurrencyService;
  let storageService: ChromeStorageService;

  beforeEach(() => {
    fakeStorage = new FakeChromeStorageLocal();
    (global as any).chrome = { 
      runtime: {}, 
      storage: { local: fakeStorage } 
    };
    
    writeQueue = new WriteQueueService();
    concurrencyService = new ConcurrencyService(writeQueue, {
      ...DEFAULT_CONCURRENCY_CONFIG,
      logOperations: false
    });
    storageService = new ChromeStorageService(concurrencyService);
  });

  afterEach(() => {
    writeQueue.clear();
    concurrencyService.resetMetrics();
  });

  it('should handle 50 concurrent saves without data loss', async () => {
    const promises = Array.from({ length: 50 }, (_, i) => 
      storageService.savePromptAtomic({
        id: '',
        name: `Concurrent Prompt ${i}`,
        template: `Template ${i}`,
        description: `Description ${i}`
      })
    );
    
    await Promise.all(promises);
    
    const prompts = await storageService.getPrompts();
    expect(prompts).toHaveLength(50);
    
    // Verify no duplicates or lost data
    const names = prompts.map(p => p.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(50);
  });

  it('should handle concurrent saves of same prompt ID', async () => {
    const sameId = 'test-prompt-id';
    
    const promises = Array.from({ length: 10 }, (_, i) => 
      storageService.savePromptAtomic({
        id: sameId,
        name: `Updated Name ${i}`,
        template: `Updated Template ${i}`,
        description: `Updated Description ${i}`
      })
    );
    
    await Promise.all(promises);
    
    const prompts = await storageService.getPrompts();
    const targetPrompt = prompts.find(p => p.id === sameId);
    
    expect(targetPrompt).toBeDefined();
    expect(targetPrompt!.name).toMatch(/Updated Name \d+/);
  });

  it('should handle mixed read/write operations', async () => {
    // Start reads and writes simultaneously
    const readPromises = Array.from({ length: 20 }, () => storageService.getPrompts());
    const writePromises = Array.from({ length: 10 }, (_, i) => 
      storageService.savePromptAtomic({
        id: '',
        name: `Mixed Prompt ${i}`,
        template: `Template ${i}`,
        description: `Description ${i}`
      })
    );
    
    const results = await Promise.all([...readPromises, ...writePromises]);
    
    // All operations should complete without errors
    expect(results).toHaveLength(30);
    
    // Verify writes persisted
    const finalPrompts = await storageService.getPrompts();
    expect(finalPrompts.length).toBeGreaterThanOrEqual(10);
  });

  it('should handle atomic delete operations', async () => {
    // Create some test data
    await storageService.savePromptAtomic({
      id: 'delete-test-1',
      name: 'Delete Test 1',
      template: 'Template 1',
      description: 'Description 1'
    });
    
    await storageService.savePromptAtomic({
      id: 'delete-test-2',
      name: 'Delete Test 2',
      template: 'Template 2',
      description: 'Description 2'
    });

    // Concurrent deletes
    const deletePromises = [
      storageService.deletePromptAtomic('delete-test-1'),
      storageService.deletePromptAtomic('delete-test-2')
    ];

    await Promise.all(deletePromises);

    const prompts = await storageService.getPrompts();
    const deletedPrompts = prompts.filter(p => 
      p.id === 'delete-test-1' || p.id === 'delete-test-2'
    );
    
    expect(deletedPrompts).toHaveLength(0);
  });

  it('should provide concurrency metrics', async () => {
    // Execute some operations
    await storageService.savePromptAtomic({
      id: 'metrics-test',
      name: 'Metrics Test',
      template: 'Template',
      description: 'Description'
    });

    const metrics = await storageService.getConcurrencyMetrics();
    expect(metrics.totalOperations).toBeGreaterThan(0);
    expect(metrics.successfulOperations).toBeGreaterThan(0);
    expect(metrics.averageLatency).toBeGreaterThan(0);
  });

  it('should fallback gracefully when no concurrency service', async () => {
    const fallbackService = new ChromeStorageService();
    
    // Should work without concurrency service
    await fallbackService.savePromptAtomic({
      id: 'fallback-test',
      name: 'Fallback Test',
      template: 'Template',
      description: 'Description'
    });

    const prompts = await fallbackService.getPrompts();
    expect(prompts.some(p => p.name === 'Fallback Test')).toBe(true);
  });
});

describe('High Concurrency Stress Tests', () => {
  let fakeStorage: FakeChromeStorageLocal;
  let writeQueue: WriteQueueService;
  let concurrencyService: ConcurrencyService;
  let storageService: ChromeStorageService;

  beforeEach(() => {
    fakeStorage = new FakeChromeStorageLocal();
    (global as any).chrome = { 
      runtime: {}, 
      storage: { local: fakeStorage } 
    };
    
    writeQueue = new WriteQueueService();
    concurrencyService = new ConcurrencyService(writeQueue, {
      ...DEFAULT_CONCURRENCY_CONFIG,
      logOperations: false
    });
    storageService = new ChromeStorageService(concurrencyService);
  });

  afterEach(() => {
    writeQueue.clear();
    concurrencyService.resetMetrics();
  });

  it('should handle 100 concurrent operations', async () => {
    const startTime = Date.now();
    
    const promises = Array.from({ length: 100 }, (_, i) => 
      storageService.savePromptAtomic({
        id: '',
        name: `Stress Test ${i}`,
        template: `Template ${i}`,
        description: `Description ${i}`
      })
    );
    
    await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const prompts = await storageService.getPrompts();
    expect(prompts).toHaveLength(100);
    
    // Should complete within reasonable time (adjust based on performance)
    expect(duration).toBeLessThan(5000); // 5 seconds max
    
    const metrics = await storageService.getConcurrencyMetrics();
    expect(metrics.totalOperations).toBeGreaterThanOrEqual(100);
    expect(metrics.successfulOperations).toBeGreaterThanOrEqual(100);
  });

  it('should maintain data consistency under high load', async () => {
    // Create initial data
    const initialPrompts = Array.from({ length: 20 }, (_, i) => ({
      id: `initial-${i}`,
      name: `Initial ${i}`,
      template: `Template ${i}`,
      description: `Description ${i}`
    }));

    for (const prompt of initialPrompts) {
      await storageService.savePromptAtomic(prompt);
    }

    // Concurrent read/write/delete operations
    const operations = [
      // Reads
      ...Array.from({ length: 30 }, () => storageService.getPrompts()),
      // Writes
      ...Array.from({ length: 20 }, (_, i) => 
        storageService.savePromptAtomic({
          id: '',
          name: `Concurrent ${i}`,
          template: `Template ${i}`,
          description: `Description ${i}`
        })
      ),
      // Deletes
      ...Array.from({ length: 10 }, (_, i) => 
        storageService.deletePromptAtomic(`initial-${i}`)
      )
    ];

    await Promise.all(operations);

    // Verify data consistency
    const finalPrompts = await storageService.getPrompts();
    
    // Should have 20 initial + 20 new - 10 deleted = 30 prompts
    expect(finalPrompts.length).toBeGreaterThanOrEqual(30);
    
    // Verify no duplicate IDs
    const ids = finalPrompts.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(finalPrompts.length);
  });
});
