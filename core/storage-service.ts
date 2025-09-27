// core/storage-service.ts
// Interface-first contract for storage implementations
import { Prompt } from './types';

// Minimal chrome shim for this workspace. In a real project, install @types/chrome.
declare const chrome: any;

export interface IStorageService {
  getPrompts(): Promise<Prompt[]>;
  savePrompt(prompt: Prompt): Promise<void>;
  deletePrompt?(id: string): Promise<void>;
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

const STORAGE_KEY = 'prompts';

const makeId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class MockStorageService implements IStorageService {
  // mirror the map-first behavior in memory
  private map: Record<string, PromptRecord> = {
    '1': { id: '1', name: 'first-principles', template: 'Apply first principles to {{topic}}', description: 'Deconstruct a problem.', createdAt: Date.now() - 20000, updatedAt: Date.now() - 20000 },
    '2': { id: '2', name: 'systems-thinking', template: 'Apply systems thinking to {{system}}', description: 'Analyze the whole system.', createdAt: Date.now() - 10000, updatedAt: Date.now() - 10000 }
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
}

export class ChromeStorageService implements IStorageService {
  // Map-first storage under chrome.storage.local.prompts

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
}

// (Prompt type is imported from ./types — do not redeclare here)

