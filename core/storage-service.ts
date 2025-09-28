// core/storage-service.ts
// Interface-first contract for storage implementations
import { Prompt, Context } from './types';
import { ConcurrencyMetrics, IConcurrencyService } from './concurrency-service';

// Minimal chrome shim for this workspace. In a real project, install @types/chrome.
declare const chrome: any;

export interface IStorageService {
  getPrompts(): Promise<Prompt[]>;
  savePrompt(prompt: Prompt): Promise<void>;
  deletePrompt?(id: string): Promise<void>;
  
  // Atomic operations for concurrency safety
  savePromptAtomic(prompt: Prompt): Promise<void>;
  deletePromptAtomic?(id: string): Promise<void>;
  
  // Context management operations
  getContexts(): Promise<Context[]>;
  saveContext(context: Context): Promise<void>;
  deleteContext?(id: string): Promise<void>;
  
  // Atomic context operations for concurrency safety
  saveContextAtomic(context: Context): Promise<void>;
  deleteContextAtomic?(id: string): Promise<void>;
  
  // Metrics and observability
  getConcurrencyMetrics?(): Promise<ConcurrencyMetrics>;
}

// Internal canonical record stored in chrome.storage.local.prompts (map by id)
type PromptRecord = {
  id: string;
  name: string;
  template: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
};

// Internal canonical record stored in chrome.storage.local.contexts (map by id)
type ContextRecord = {
  id: string;
  name: string;
  text: string;
  createdAt?: number;
  updatedAt?: number;
};

const STORAGE_KEY = 'prompts';
const CONTEXTS_STORAGE_KEY = 'contexts';

const makeId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class MockStorageService implements IStorageService {
  // mirror the map-first behavior in memory
  private map: Record<string, PromptRecord> = {
    '1': { id: '1', name: 'first-principles', template: 'Apply first principles to {{topic}}', description: 'Deconstruct a problem.', createdAt: Date.now() - 20000, updatedAt: Date.now() - 20000 },
    '2': { id: '2', name: 'systems-thinking', template: 'Apply systems thinking to {{system}}', description: 'Analyze the whole system.', createdAt: Date.now() - 10000, updatedAt: Date.now() - 10000 }
  };

  // Context storage mirror
  private contextMap: Record<string, ContextRecord> = {
    'c1': { id: 'c1', name: 'React Best Practices', text: 'Use functional components with hooks instead of class components.', createdAt: Date.now() - 30000, updatedAt: Date.now() - 30000 },
    'c2': { id: 'c2', name: 'API Design', text: 'Design RESTful APIs with clear resource naming and proper HTTP status codes.', createdAt: Date.now() - 25000, updatedAt: Date.now() - 25000 }
  };

  constructor(initial?: Record<string, PromptRecord>) {
    if (initial) this.map = { ...initial };
  }

  private mapToArray(): Prompt[] {
    const arr = Object.values(this.map).map(r => ({ id: r.id, name: r.name, template: r.template, description: r.description || '' }));
    // deterministic sort by createdAt ascending (fallback to id)
    arr.sort((a, b) => {
      const ra = this.map[a.id]?.createdAt ?? 0;
      const rb = this.map[b.id]?.createdAt ?? 0;
      if (ra !== rb) return ra - rb;
      return a.id.localeCompare(b.id);
    });
    return arr;
  }

  async getPrompts(): Promise<Prompt[]> {
    return this.mapToArray();
  }

  async savePrompt(prompt: Prompt): Promise<void> {
    const id = prompt.id || makeId();
    const prev = this.map[id];
    const createdAt = prev?.createdAt || prompt['createdAt'] || Date.now();
    this.map[id] = { ...prev, ...prompt, id, createdAt, updatedAt: Date.now() };
  }

  async deletePrompt(id: string): Promise<void> {
    delete this.map[id];
  }

  // Atomic operations (same as regular operations for mock)
  async savePromptAtomic(prompt: Prompt): Promise<void> {
    return this.savePrompt(prompt);
  }

  async deletePromptAtomic(id: string): Promise<void> {
    return this.deletePrompt(id);
  }

  // Context management methods
  private contextMapToArray(): Context[] {
    const arr = Object.values(this.contextMap).map(r => ({ id: r.id, name: r.name, text: r.text }));
    // deterministic sort by createdAt ascending (fallback to id)
    arr.sort((a, b) => {
      const ra = this.contextMap[a.id]?.createdAt ?? 0;
      const rb = this.contextMap[b.id]?.createdAt ?? 0;
      if (ra !== rb) return ra - rb;
      return a.id.localeCompare(b.id);
    });
    return arr;
  }

  async getContexts(): Promise<Context[]> {
    return this.contextMapToArray();
  }

  async saveContext(context: Context): Promise<void> {
    const id = context.id || makeId();
    const prev = this.contextMap[id];
    const createdAt = prev?.createdAt || context.createdAt || Date.now();
    this.contextMap[id] = { ...prev, ...context, id, createdAt, updatedAt: Date.now() };
  }

  async deleteContext(id: string): Promise<void> {
    delete this.contextMap[id];
  }

  // Atomic context operations (same as prompts)
  async saveContextAtomic(context: Context): Promise<void> {
    return this.saveContext(context);
  }

  async deleteContextAtomic(id: string): Promise<void> {
    return this.deleteContext(id);
  }
}

export class ChromeStorageService implements IStorageService {
  // Map-first storage under chrome.storage.local.prompts
  private concurrencyService?: IConcurrencyService;

  constructor(concurrencyService?: IConcurrencyService) {
    this.concurrencyService = concurrencyService;
  }

  private async readPromptsMap(): Promise<Record<string, PromptRecord>> {
    return new Promise<Record<string, PromptRecord>>((resolve, reject) => {
      try {
        chrome.storage.local.get([STORAGE_KEY], async (result: any) => {
          if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          const val = result && result[STORAGE_KEY];
          // No key
          if (val === undefined) return resolve({});
          // Already a map/object
          if (typeof val === 'object' && !Array.isArray(val)) return resolve(val as Record<string, PromptRecord>);
          // Legacy array migration
          if (Array.isArray(val)) {
            const arr: any[] = val;
            const map: Record<string, PromptRecord> = {};
            for (const item of arr) {
              const id = item.id || makeId();
              const createdAt = item.createdAt || Date.now();
              map[id] = { id, name: item.name, template: item.template, description: item.description, createdAt, updatedAt: item.updatedAt || createdAt };
            }
            // Persist migrated map
            try {
              await this.writePromptsMap(map);
              return resolve(map);
            } catch (err) {
              return reject(err);
            }
          }
          // Unexpected type
          console.warn('ChromeStorageService: unexpected prompts value, returning empty map.');
          return resolve({});
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private async writePromptsMap(map: Record<string, PromptRecord>): Promise<void> {
    // Merge with latest stored value just before writing to reduce clobber races.
    return new Promise<void>((resolve, reject) => {
      try {
        chrome.storage.local.get([STORAGE_KEY], (result: any) => {
          if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          const current = result && result[STORAGE_KEY] && typeof result[STORAGE_KEY] === 'object' && !Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] as Record<string, PromptRecord> : {};
          const merged = { ...current, ...map } as Record<string, PromptRecord>;
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
  async getPrompts(): Promise<Prompt[]> {
    const map = await this.readPromptsMap();
    const arr = Object.values(map).map(r => ({ id: r.id, name: r.name, template: r.template, description: r.description || '' }));
    arr.sort((a, b) => {
      const ra = map[a.id]?.createdAt ?? 0;
      const rb = map[b.id]?.createdAt ?? 0;
      if (ra !== rb) return ra - rb;
      return a.id.localeCompare(b.id);
    });
    return arr;
  }

  async savePrompt(prompt: Prompt): Promise<void> {
    const id = prompt.id || makeId();
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const map = await this.readPromptsMap();
        const prev = map[id];
        const createdAt = prev?.createdAt || (prompt as any).createdAt || Date.now();
        map[id] = { ...prev, ...prompt, id, createdAt, updatedAt: Date.now() };
        await this.writePromptsMap(map);
        // Verify our write took effect; if not, retry
        const after = await this.readPromptsMap();
        if (!after[id]) {
          lastErr = new Error('write did not persist entry, retrying');
          await delay(20);
          continue;
        }
        return;
      } catch (err) {
        lastErr = err;
        // small backoff
        await delay(20);
        continue;
      }
    }
    throw new Error('savePrompt failed after retries: ' + (lastErr && lastErr.message ? lastErr.message : String(lastErr)));
  }

  async deletePrompt(id: string): Promise<void> {
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const map = await this.readPromptsMap();
        if (map.hasOwnProperty(id)) delete map[id];
        await this.writePromptsMap(map);
        // Verify deletion
        const after = await this.readPromptsMap();
        if (after[id]) {
          lastErr = new Error('delete did not persist, retrying');
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
    throw new Error('deletePrompt failed after retries: ' + (lastErr && lastErr.message ? lastErr.message : String(lastErr)));
  }

  // Atomic operations for concurrency safety
  async savePromptAtomic(prompt: Prompt): Promise<void> {
    if (this.concurrencyService) {
      return this.concurrencyService.executeAtomicWithRetry(async () => {
        const id = prompt.id || makeId();
        const map = await this.readPromptsMap();
        const prev = map[id];
        const createdAt = prev?.createdAt || (prompt as any).createdAt || Date.now();
        
        map[id] = { 
          ...prev, 
          ...prompt, 
          id, 
          createdAt, 
          updatedAt: Date.now() 
        };
        
        await this.writePromptsMap(map);
        
        // Verify write persisted
        const after = await this.readPromptsMap();
        if (!after[id]) {
          throw new Error('Atomic write verification failed');
        }
      });
    } else {
      // Fallback to regular savePrompt if no concurrency service
      return this.savePrompt(prompt);
    }
  }

  async deletePromptAtomic(id: string): Promise<void> {
    if (this.concurrencyService) {
      return this.concurrencyService.executeAtomicWithRetry(async () => {
        const map = await this.readPromptsMap();
        if (map.hasOwnProperty(id)) {
          delete map[id];
          await this.writePromptsMap(map);
          
          // Verify deletion
          const after = await this.readPromptsMap();
          if (after[id]) {
            throw new Error('Atomic delete verification failed');
          }
        }
      });
    } else {
      // Fallback to regular deletePrompt if no concurrency service
      return this.deletePrompt(id);
    }
  }

  // Context management methods
  private async readContextsMap(): Promise<Record<string, ContextRecord>> {
    return new Promise<Record<string, ContextRecord>>((resolve, reject) => {
      try {
        chrome.storage.local.get([CONTEXTS_STORAGE_KEY], async (result: any) => {
          if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          const val = result && result[CONTEXTS_STORAGE_KEY];
          // No key
          if (val === undefined) return resolve({});
          // Already a map/object
          if (typeof val === 'object' && !Array.isArray(val)) return resolve(val as Record<string, ContextRecord>);
          // Legacy array migration
          if (Array.isArray(val)) {
            const arr: any[] = val;
            const map: Record<string, ContextRecord> = {};
            for (const item of arr) {
              const id = item.id || makeId();
              const createdAt = item.createdAt || Date.now();
              map[id] = { id, name: item.name, text: item.text, createdAt, updatedAt: item.updatedAt || createdAt };
            }
            // Persist migrated map
            try {
              await this.writeContextsMap(map);
              return resolve(map);
            } catch (err) {
              return reject(err);
            }
          }
          // Unexpected type
          console.warn('ChromeStorageService: unexpected contexts value, returning empty map.');
          return resolve({});
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private async writeContextsMap(map: Record<string, ContextRecord>): Promise<void> {
    // Merge with latest stored value just before writing to reduce clobber races.
    return new Promise<void>((resolve, reject) => {
      try {
        chrome.storage.local.get([CONTEXTS_STORAGE_KEY], (result: any) => {
          if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          const current = result && result[CONTEXTS_STORAGE_KEY] && typeof result[CONTEXTS_STORAGE_KEY] === 'object' && !Array.isArray(result[CONTEXTS_STORAGE_KEY]) ? result[CONTEXTS_STORAGE_KEY] as Record<string, ContextRecord> : {};
          const merged = { ...current, ...map } as Record<string, ContextRecord>;
          chrome.storage.local.set({ [CONTEXTS_STORAGE_KEY]: merged }, () => {
            if (chrome.runtime && chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve();
          });
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async getContexts(): Promise<Context[]> {
    const map = await this.readContextsMap();
    const arr = Object.values(map).map(r => ({ id: r.id, name: r.name, text: r.text }));
    arr.sort((a, b) => {
      const ra = map[a.id]?.createdAt ?? 0;
      const rb = map[b.id]?.createdAt ?? 0;
      if (ra !== rb) return ra - rb;
      return a.id.localeCompare(b.id);
    });
    return arr;
  }

  async saveContext(context: Context): Promise<void> {
    const id = context.id || makeId();
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const map = await this.readContextsMap();
        const prev = map[id];
        const createdAt = prev?.createdAt || (context as any).createdAt || Date.now();
        map[id] = { ...prev, ...context, id, createdAt, updatedAt: Date.now() };
        await this.writeContextsMap(map);
        // Verify our write took effect; if not, retry
        const after = await this.readContextsMap();
        if (!after[id]) {
          lastErr = new Error('write did not persist entry, retrying');
          await delay(20);
          continue;
        }
        return;
      } catch (err) {
        lastErr = err;
        // small backoff
        await delay(20);
        continue;
      }
    }
    throw new Error('saveContext failed after retries: ' + (lastErr && lastErr.message ? lastErr.message : String(lastErr)));
  }

  async deleteContext(id: string): Promise<void> {
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const map = await this.readContextsMap();
        if (map.hasOwnProperty(id)) delete map[id];
        await this.writeContextsMap(map);
        // Verify deletion
        const after = await this.readContextsMap();
        if (after[id]) {
          lastErr = new Error('delete did not persist, retrying');
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
    throw new Error('deleteContext failed after retries: ' + (lastErr && lastErr.message ? lastErr.message : String(lastErr)));
  }

  // Atomic context operations for concurrency safety
  async saveContextAtomic(context: Context): Promise<void> {
    if (this.concurrencyService) {
      return this.concurrencyService.executeAtomicWithRetry(async () => {
        const id = context.id || makeId();
        const map = await this.readContextsMap();
        const prev = map[id];
        const createdAt = prev?.createdAt || (context as any).createdAt || Date.now();
        
        map[id] = { 
          ...prev, 
          ...context, 
          id, 
          createdAt, 
          updatedAt: Date.now() 
        };
        
        await this.writeContextsMap(map);
        
        // Verify write persisted
        const after = await this.readContextsMap();
        if (!after[id]) {
          throw new Error('Atomic write verification failed');
        }
      });
    } else {
      // Fallback to regular saveContext if no concurrency service
      return this.saveContext(context);
    }
  }

  async deleteContextAtomic(id: string): Promise<void> {
    if (this.concurrencyService) {
      return this.concurrencyService.executeAtomicWithRetry(async () => {
        const map = await this.readContextsMap();
        if (map.hasOwnProperty(id)) {
          delete map[id];
          await this.writeContextsMap(map);
          
          // Verify deletion
          const after = await this.readContextsMap();
          if (after[id]) {
            throw new Error('Atomic delete verification failed');
          }
        }
      });
    } else {
      // Fallback to regular deleteContext if no concurrency service
      return this.deleteContext(id);
    }
  }

  async getConcurrencyMetrics(): Promise<ConcurrencyMetrics> {
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
}

// (Prompt type is imported from ./types — do not redeclare here)

