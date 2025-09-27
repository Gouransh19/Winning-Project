// core/concurrency-service.ts
// Interface-first contract for concurrency control and atomic operations

/**
 * Metrics interface for monitoring concurrency operations
 */
export interface ConcurrencyMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageLatency: number;
  queueDepth: number;
  lastOperationTime: number;
}

/**
 * Interface for operations that can be queued and executed atomically
 */
export interface QueuedOperation<T = any> {
  id: string;
  operation: () => Promise<T>;
  timestamp: number;
  retryCount: number;
}

/**
 * Interface for a write queue that serializes operations
 */
export interface IWriteQueue {
  /**
   * Enqueue an operation for atomic execution
   * @param operation The operation to execute
   * @returns Promise that resolves with the operation result
   */
  enqueue<T>(operation: () => Promise<T>): Promise<T>;
  
  /**
   * Get current queue depth
   */
  getQueueDepth(): number;
  
  /**
   * Flush all pending operations
   */
  flush(): Promise<void>;
  
  /**
   * Clear the queue (for testing/cleanup)
   */
  clear(): void;
  
  /**
   * Get current metrics (optional - may not be implemented by all queue types)
   */
  getMetrics?(): ConcurrencyMetrics;
  
  /**
   * Reset metrics (optional - may not be implemented by all queue types)
   */
  resetMetrics?(): void;
}

/**
 * Interface for concurrency control service
 */
export interface IConcurrencyService {
  /**
   * Execute an operation atomically (with queue serialization)
   * @param operation The operation to execute
   * @returns Promise that resolves with the operation result
   */
  executeAtomic<T>(operation: () => Promise<T>): Promise<T>;
  
  /**
   * Execute an operation with retry logic
   * @param operation The operation to execute
   * @param maxRetries Maximum number of retry attempts
   * @returns Promise that resolves with the operation result
   */
  executeWithRetry<T>(operation: () => Promise<T>, maxRetries?: number): Promise<T>;
  
  /**
   * Execute an operation atomically with retry logic
   * @param operation The operation to execute
   * @param maxRetries Maximum number of retry attempts
   * @returns Promise that resolves with the operation result
   */
  executeAtomicWithRetry<T>(operation: () => Promise<T>, maxRetries?: number): Promise<T>;
  
  /**
   * Get current concurrency metrics
   */
  getMetrics(): ConcurrencyMetrics;
  
  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void;
}

/**
 * Configuration for concurrency service
 */
export interface ConcurrencyConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  enableMetrics: boolean;
  logOperations: boolean;
}

/**
 * Default configuration for concurrency service
 */
export const DEFAULT_CONCURRENCY_CONFIG: ConcurrencyConfig = {
  maxRetries: 3,
  baseDelayMs: 10,
  maxDelayMs: 1000,
  enableMetrics: true,
  logOperations: false
};

/**
 * Utility function for exponential backoff delay
 */
export const calculateBackoffDelay = (attempt: number, baseDelay: number, maxDelay: number): number => {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  return Math.min(delay, maxDelay);
};

/**
 * Utility function for generating operation IDs
 */
export const generateOperationId = (): string => {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * Write queue service that serializes operations to prevent race conditions
 */
export class WriteQueueService implements IWriteQueue {
  private queue: QueuedOperation[] = [];
  private processing = false;
  private metrics: ConcurrencyMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageLatency: 0,
    queueDepth: 0,
    lastOperationTime: 0
  };

  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const operationId = generateOperationId();
    const startTime = Date.now();
    
    return new Promise<T>((resolve, reject) => {
      const queuedOp: QueuedOperation<T> = {
        id: operationId,
        operation: async () => {
          try {
            const result = await operation();
            this.recordOperation(true, Date.now() - startTime);
            resolve(result);
            return result;
          } catch (error) {
            this.recordOperation(false, Date.now() - startTime);
            reject(error);
            throw error;
          }
        },
        timestamp: startTime,
        retryCount: 0
      };

      this.queue.push(queuedOp);
      this.updateQueueDepth();
      this.processQueue();
    });
  }

  getQueueDepth(): number {
    return this.queue.length;
  }

  async flush(): Promise<void> {
    while (this.queue.length > 0) {
      await this.processQueue();
      // Small delay to prevent busy waiting
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  clear(): void {
    this.queue = [];
    this.updateQueueDepth();
  }

  getMetrics(): ConcurrencyMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageLatency: 0,
      queueDepth: this.queue.length,
      lastOperationTime: 0
    };
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    
    try {
      while (this.queue.length > 0) {
        const operation = this.queue.shift()!;
        this.updateQueueDepth();
        
        try {
          await operation.operation();
        } catch (error) {
          // Operation already handled error reporting in its wrapper
          // Just continue processing the queue
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private updateQueueDepth(): void {
    this.metrics.queueDepth = this.queue.length;
  }

  private recordOperation(success: boolean, latency: number): void {
    this.metrics.totalOperations++;
    
    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
    }

    // Update average latency using running average
    if (this.metrics.totalOperations === 1) {
      this.metrics.averageLatency = latency;
    } else {
      const totalLatency = this.metrics.averageLatency * (this.metrics.totalOperations - 1) + latency;
      this.metrics.averageLatency = totalLatency / this.metrics.totalOperations;
    }
    
    this.metrics.lastOperationTime = Date.now();
  }
}

/**
 * Concurrency service that provides atomic operations with retry logic
 */
export class ConcurrencyService implements IConcurrencyService {
  private metrics: ConcurrencyMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageLatency: 0,
    queueDepth: 0,
    lastOperationTime: 0
  };

  constructor(
    private writeQueue: IWriteQueue,
    private config: ConcurrencyConfig = DEFAULT_CONCURRENCY_CONFIG
  ) {}

  async executeAtomic<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await this.writeQueue.enqueue(operation);
      this.recordOperation(true, Date.now() - startTime);
      return result;
    } catch (error) {
      this.recordOperation(false, Date.now() - startTime);
      throw error;
    }
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>, 
    maxRetries: number = this.config.maxRetries
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        this.recordOperation(true, Date.now() - startTime);
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (this.config.logOperations) {
          console.log(`ConcurrencyService: Operation failed (attempt ${attempt}/${maxRetries}):`, error);
        }
        
        if (attempt < maxRetries) {
          const delay = calculateBackoffDelay(attempt, this.config.baseDelayMs, this.config.maxDelayMs);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    this.recordOperation(false, Date.now() - startTime);
    throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  async executeAtomicWithRetry<T>(
    operation: () => Promise<T>, 
    maxRetries: number = this.config.maxRetries
  ): Promise<T> {
    return this.executeAtomic(() => 
      this.executeWithRetry(operation, maxRetries)
    );
  }

  getMetrics(): ConcurrencyMetrics {
    const queueMetrics = this.writeQueue.getMetrics ? this.writeQueue.getMetrics() : {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageLatency: 0,
      queueDepth: this.writeQueue.getQueueDepth(),
      lastOperationTime: 0
    };

    return {
      totalOperations: this.metrics.totalOperations + queueMetrics.totalOperations,
      successfulOperations: this.metrics.successfulOperations + queueMetrics.successfulOperations,
      failedOperations: this.metrics.failedOperations + queueMetrics.failedOperations,
      averageLatency: this.calculateCombinedAverageLatency(this.metrics, queueMetrics),
      queueDepth: queueMetrics.queueDepth,
      lastOperationTime: Math.max(this.metrics.lastOperationTime, queueMetrics.lastOperationTime)
    };
  }

  resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageLatency: 0,
      queueDepth: 0,
      lastOperationTime: 0
    };
    
    if (this.writeQueue.resetMetrics) {
      this.writeQueue.resetMetrics();
    }
  }

  private recordOperation(success: boolean, latency: number): void {
    if (!this.config.enableMetrics) return;
    
    this.metrics.totalOperations++;
    
    if (success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
    }

    // Update average latency using running average
    if (this.metrics.totalOperations === 1) {
      this.metrics.averageLatency = latency;
    } else {
      const totalLatency = this.metrics.averageLatency * (this.metrics.totalOperations - 1) + latency;
      this.metrics.averageLatency = totalLatency / this.metrics.totalOperations;
    }
    
    this.metrics.lastOperationTime = Date.now();
  }

  private calculateCombinedAverageLatency(metrics1: ConcurrencyMetrics, metrics2: ConcurrencyMetrics): number {
    const totalOps = metrics1.totalOperations + metrics2.totalOperations;
    if (totalOps === 0) return 0;
    
    const totalLatency = (metrics1.averageLatency * metrics1.totalOperations) + 
                        (metrics2.averageLatency * metrics2.totalOperations);
    
    return totalLatency / totalOps;
  }
}
