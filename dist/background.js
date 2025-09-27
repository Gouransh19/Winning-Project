"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // core/storage-service.ts
  var STORAGE_KEY = "prompts";
  var makeId = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  var delay = (ms) => new Promise((res) => setTimeout(res, ms));
  var ChromeStorageService = class {
    constructor(concurrencyService2) {
      this.concurrencyService = concurrencyService2;
    }
    async readPromptsMap() {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.get([STORAGE_KEY], async (result) => {
            if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            const val = result && result[STORAGE_KEY];
            if (val === void 0) return resolve({});
            if (typeof val === "object" && !Array.isArray(val)) return resolve(val);
            if (Array.isArray(val)) {
              const arr = val;
              const map = {};
              for (const item of arr) {
                const id = item.id || makeId();
                const createdAt = item.createdAt || Date.now();
                map[id] = { id, name: item.name, template: item.template, description: item.description, createdAt, updatedAt: item.updatedAt || createdAt };
              }
              try {
                await this.writePromptsMap(map);
                return resolve(map);
              } catch (err) {
                return reject(err);
              }
            }
            console.warn("ChromeStorageService: unexpected prompts value, returning empty map.");
            return resolve({});
          });
        } catch (err) {
          reject(err);
        }
      });
    }
    async writePromptsMap(map) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.get([STORAGE_KEY], (result) => {
            if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            const current = result && result[STORAGE_KEY] && typeof result[STORAGE_KEY] === "object" && !Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : {};
            const merged = __spreadValues(__spreadValues({}, current), map);
            chrome.storage.local.set({ [STORAGE_KEY]: merged }, () => {
              if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
              resolve();
            });
          });
        } catch (err) {
          reject(err);
        }
      });
    }
    // Public API
    async getPrompts() {
      const map = await this.readPromptsMap();
      const arr = Object.values(map).map((r) => ({ id: r.id, name: r.name, template: r.template, description: r.description || "" }));
      arr.sort((a, b) => {
        var _a, _b, _c, _d;
        const ra = (_b = (_a = map[a.id]) == null ? void 0 : _a.createdAt) != null ? _b : 0;
        const rb = (_d = (_c = map[b.id]) == null ? void 0 : _c.createdAt) != null ? _d : 0;
        if (ra !== rb) return ra - rb;
        return a.id.localeCompare(b.id);
      });
      return arr;
    }
    async savePrompt(prompt) {
      const id = prompt.id || makeId();
      let lastErr = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const map = await this.readPromptsMap();
          const prev = map[id];
          const createdAt = (prev == null ? void 0 : prev.createdAt) || prompt.createdAt || Date.now();
          map[id] = __spreadProps(__spreadValues(__spreadValues({}, prev), prompt), { id, createdAt, updatedAt: Date.now() });
          await this.writePromptsMap(map);
          const after = await this.readPromptsMap();
          if (!after[id]) {
            lastErr = new Error("write did not persist entry, retrying");
            await delay(20);
            continue;
          }
          return;
        } catch (err) {
          lastErr = err;
          await delay(20);
          continue;
        }
      }
      throw new Error("savePrompt failed after retries: " + (lastErr && lastErr.message ? lastErr.message : String(lastErr)));
    }
    async deletePrompt(id) {
      let lastErr = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const map = await this.readPromptsMap();
          if (map.hasOwnProperty(id)) delete map[id];
          await this.writePromptsMap(map);
          const after = await this.readPromptsMap();
          if (after[id]) {
            lastErr = new Error("delete did not persist, retrying");
            await delay(20);
            continue;
          }
          return;
        } catch (err) {
          lastErr = err;
          await delay(20);
          continue;
        }
      }
      throw new Error("deletePrompt failed after retries: " + (lastErr && lastErr.message ? lastErr.message : String(lastErr)));
    }
    // Atomic operations for concurrency safety
    async savePromptAtomic(prompt) {
      if (this.concurrencyService) {
        return this.concurrencyService.executeAtomicWithRetry(async () => {
          const id = prompt.id || makeId();
          const map = await this.readPromptsMap();
          const prev = map[id];
          const createdAt = (prev == null ? void 0 : prev.createdAt) || prompt.createdAt || Date.now();
          map[id] = __spreadProps(__spreadValues(__spreadValues({}, prev), prompt), {
            id,
            createdAt,
            updatedAt: Date.now()
          });
          await this.writePromptsMap(map);
          const after = await this.readPromptsMap();
          if (!after[id]) {
            throw new Error("Atomic write verification failed");
          }
        });
      } else {
        return this.savePrompt(prompt);
      }
    }
    async deletePromptAtomic(id) {
      if (this.concurrencyService) {
        return this.concurrencyService.executeAtomicWithRetry(async () => {
          const map = await this.readPromptsMap();
          if (map.hasOwnProperty(id)) {
            delete map[id];
            await this.writePromptsMap(map);
            const after = await this.readPromptsMap();
            if (after[id]) {
              throw new Error("Atomic delete verification failed");
            }
          }
        });
      } else {
        return this.deletePrompt(id);
      }
    }
    async getConcurrencyMetrics() {
      if (this.concurrencyService) {
        return this.concurrencyService.getMetrics();
      } else {
        return {
          totalOperations: 0,
          successfulOperations: 0,
          failedOperations: 0,
          averageLatency: 0,
          queueDepth: 0,
          lastOperationTime: 0
        };
      }
    }
  };

  // core/concurrency-service.ts
  var DEFAULT_CONCURRENCY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 10,
    maxDelayMs: 1e3,
    enableMetrics: true,
    logOperations: false
  };
  var calculateBackoffDelay = (attempt, baseDelay, maxDelay) => {
    const delay2 = baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay2, maxDelay);
  };
  var generateOperationId = () => {
    return "op_".concat(Date.now(), "_").concat(Math.random().toString(36).slice(2, 8));
  };
  var WriteQueueService = class {
    constructor() {
      this.queue = [];
      this.processing = false;
      this.metrics = {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageLatency: 0,
        queueDepth: 0,
        lastOperationTime: 0
      };
    }
    async enqueue(operation) {
      const operationId = generateOperationId();
      const startTime = Date.now();
      return new Promise((resolve, reject) => {
        const queuedOp = {
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
    getQueueDepth() {
      return this.queue.length;
    }
    async flush() {
      while (this.queue.length > 0) {
        await this.processQueue();
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }
    clear() {
      this.queue = [];
      this.updateQueueDepth();
    }
    getMetrics() {
      return __spreadValues({}, this.metrics);
    }
    resetMetrics() {
      this.metrics = {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageLatency: 0,
        queueDepth: this.queue.length,
        lastOperationTime: 0
      };
    }
    async processQueue() {
      if (this.processing || this.queue.length === 0) {
        return;
      }
      this.processing = true;
      try {
        while (this.queue.length > 0) {
          const operation = this.queue.shift();
          this.updateQueueDepth();
          try {
            await operation.operation();
          } catch (error) {
          }
        }
      } finally {
        this.processing = false;
      }
    }
    updateQueueDepth() {
      this.metrics.queueDepth = this.queue.length;
    }
    recordOperation(success, latency) {
      this.metrics.totalOperations++;
      if (success) {
        this.metrics.successfulOperations++;
      } else {
        this.metrics.failedOperations++;
      }
      if (this.metrics.totalOperations === 1) {
        this.metrics.averageLatency = latency;
      } else {
        const totalLatency = this.metrics.averageLatency * (this.metrics.totalOperations - 1) + latency;
        this.metrics.averageLatency = totalLatency / this.metrics.totalOperations;
      }
      this.metrics.lastOperationTime = Date.now();
    }
  };
  var ConcurrencyService = class {
    constructor(writeQueue2, config = DEFAULT_CONCURRENCY_CONFIG) {
      this.writeQueue = writeQueue2;
      this.config = config;
      this.metrics = {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageLatency: 0,
        queueDepth: 0,
        lastOperationTime: 0
      };
    }
    async executeAtomic(operation) {
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
    async executeWithRetry(operation, maxRetries = this.config.maxRetries) {
      const startTime = Date.now();
      let lastError = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await operation();
          this.recordOperation(true, Date.now() - startTime);
          return result;
        } catch (error) {
          lastError = error;
          if (this.config.logOperations) {
            console.log("ConcurrencyService: Operation failed (attempt ".concat(attempt, "/").concat(maxRetries, "):"), error);
          }
          if (attempt < maxRetries) {
            const delay2 = calculateBackoffDelay(attempt, this.config.baseDelayMs, this.config.maxDelayMs);
            await new Promise((resolve) => setTimeout(resolve, delay2));
          }
        }
      }
      this.recordOperation(false, Date.now() - startTime);
      throw new Error("Operation failed after ".concat(maxRetries, " attempts: ").concat((lastError == null ? void 0 : lastError.message) || "Unknown error"));
    }
    async executeAtomicWithRetry(operation, maxRetries = this.config.maxRetries) {
      return this.executeAtomic(
        () => this.executeWithRetry(operation, maxRetries)
      );
    }
    getMetrics() {
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
    resetMetrics() {
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
    recordOperation(success, latency) {
      if (!this.config.enableMetrics) return;
      this.metrics.totalOperations++;
      if (success) {
        this.metrics.successfulOperations++;
      } else {
        this.metrics.failedOperations++;
      }
      if (this.metrics.totalOperations === 1) {
        this.metrics.averageLatency = latency;
      } else {
        const totalLatency = this.metrics.averageLatency * (this.metrics.totalOperations - 1) + latency;
        this.metrics.averageLatency = totalLatency / this.metrics.totalOperations;
      }
      this.metrics.lastOperationTime = Date.now();
    }
    calculateCombinedAverageLatency(metrics1, metrics2) {
      const totalOps = metrics1.totalOperations + metrics2.totalOperations;
      if (totalOps === 0) return 0;
      const totalLatency = metrics1.averageLatency * metrics1.totalOperations + metrics2.averageLatency * metrics2.totalOperations;
      return totalLatency / totalOps;
    }
  };

  // background.ts
  var writeQueue = new WriteQueueService();
  var concurrencyService = new ConcurrencyService(writeQueue, __spreadProps(__spreadValues({}, DEFAULT_CONCURRENCY_CONFIG), {
    logOperations: true,
    // Enable logging for debugging
    enableMetrics: true
  }));
  var storage = new ChromeStorageService(concurrencyService);
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("BACKGROUND: received message", message);
    switch (message.type) {
      case "GET_PROMPTS_REQUEST":
        storage.getPrompts().then((prompts) => {
          sendResponse({ type: "GET_PROMPTS_RESPONSE", payload: prompts });
        });
        break;
      case "SAVE_PROMPT_REQUEST":
        console.log("BACKGROUND: saving prompt atomically", message.payload);
        storage.savePromptAtomic({
          id: "",
          // Will be generated by storage service
          name: message.payload.name,
          template: message.payload.template,
          description: message.payload.description
        }).then(() => {
          console.log("BACKGROUND: prompt saved successfully with atomic operation");
          sendResponse({ type: "SAVE_PROMPT_RESPONSE", payload: { success: true } });
        }).catch((error) => {
          console.error("BACKGROUND: failed to save prompt atomically", error);
          sendResponse({ type: "SAVE_PROMPT_RESPONSE", payload: { success: false, error: error.message } });
        });
        break;
      case "GET_CONCURRENCY_METRICS_REQUEST":
        console.log("BACKGROUND: providing concurrency metrics");
        storage.getConcurrencyMetrics().then((metrics) => {
          sendResponse({ type: "GET_CONCURRENCY_METRICS_RESPONSE", payload: metrics });
        }).catch((error) => {
          console.error("BACKGROUND: failed to get concurrency metrics", error);
          sendResponse({ type: "GET_CONCURRENCY_METRICS_RESPONSE", payload: null });
        });
        break;
    }
    return true;
  });
})();
//# sourceMappingURL=background.js.map
