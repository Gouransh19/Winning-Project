import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorageService, ChromeStorageService } from '../core/storage-service';
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

describe('MockStorageService (map-first in-memory)', () => {
  it('returns deterministic array and save/delete work', async () => {
    const mock = new MockStorageService();
    const before = await mock.getPrompts();
    expect(Array.isArray(before)).toBe(true);
    const p: Prompt = { id: '', name: 'x', template: 't', description: 'd' };
    await mock.savePrompt(p);
    const after = await mock.getPrompts();
    expect(after.some(a => a.name === 'x')).toBe(true);
    // find the saved id
    const saved = after.find(a => a.name === 'x') as Prompt;
    expect(saved.id).toBeTruthy();
    await (mock as any).deletePrompt(saved.id);
    const afterDel = await mock.getPrompts();
    expect(afterDel.some(a => a.name === 'x')).toBe(false);
  });
});

describe('ChromeStorageService (map-first + migration + retries)', () => {
  beforeEach(() => {
    (global as any).chrome = { runtime: {}, storage: { local: new FakeChromeStorageLocal() } };
  });

  it('migrates legacy array to map on read', async () => {
    const fake = (global as any).chrome.storage.local as FakeChromeStorageLocal;
    fake.store['prompts'] = [ { name: 'legacy', template: 't', description: 'd' } ];
    const svc = new ChromeStorageService();
    const prompts = await svc.getPrompts();
    expect(prompts.length).toBe(1);
    const stored = fake.store['prompts'];
    expect(typeof stored).toBe('object');
    // should be a map keyed by id
    const keys = Object.keys(stored);
    expect(keys.length).toBe(1);
    const rec = stored[keys[0]];
    expect(rec.name).toBe('legacy');
  });

  it('savePrompt assigns id and persists', async () => {
    const svc = new ChromeStorageService();
    const p: Prompt = { id: '', name: 'aaa', template: 'tt', description: '' };
    await svc.savePrompt(p);
    const fake = (global as any).chrome.storage.local as FakeChromeStorageLocal;
    const stored = fake.store['prompts'];
    const keys = Object.keys(stored);
    expect(keys.length).toBeGreaterThan(0);
    const rec = stored[keys[0]];
    expect(rec.name).toBe('aaa');
  });

  it('concurrent saves for different ids both persist', async () => {
    const svc = new ChromeStorageService();
    const p1: Prompt = { id: 'id-a', name: 'A', template: 't', description: '' };
    const p2: Prompt = { id: 'id-b', name: 'B', template: 't', description: '' };
    await Promise.all([svc.savePrompt(p1), svc.savePrompt(p2)]);
    const fake = (global as any).chrome.storage.local as FakeChromeStorageLocal;
    const stored = fake.store['prompts'];
    const keys = Object.keys(stored);
    expect(keys.includes('id-a')).toBe(true);
    expect(keys.includes('id-b')).toBe(true);
  });
});
