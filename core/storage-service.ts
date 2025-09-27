// core/storage-service.ts
// Interface-first contract for storage implementations
import { Prompt } from './types';

// Minimal chrome shim for this workspace. In a real project, install @types/chrome.
declare const chrome: any;

export interface IStorageService {
  getPrompts(): Promise<Prompt[]>;
  savePrompt(prompt: Prompt): Promise<void>;
}

export class MockStorageService implements IStorageService {
  private prompts: Prompt[] = [
    { id: '1', name: 'first-principles', template: 'Apply first principles to {{topic}}', description: 'Deconstruct a problem.' },
    { id: '2', name: 'systems-thinking', template: 'Apply systems thinking to {{system}}', description: 'Analyze the whole system.' }
  ];

  async getPrompts(): Promise<Prompt[]> {
    console.log("MOCK STORAGE: Returning hardcoded prompts.");
    return this.prompts;
  }

  async savePrompt(prompt: Prompt): Promise<void> {
    console.log("MOCK STORAGE: Pretending to save prompt:", prompt.name);
    this.prompts.push(prompt);
  }
}

export class ChromeStorageService implements IStorageService {
  // Uses chrome.storage.local to persist prompts under the 'prompts' key
  async getPrompts(): Promise<Prompt[]> {
    return new Promise<Prompt[]>((resolve, reject) => {
      try {
        chrome.storage.local.get(['prompts'], (result: any) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          const prompts: Prompt[] = result && Array.isArray(result.prompts) ? result.prompts : [];
          resolve(prompts);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async savePrompt(prompt: Prompt): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        chrome.storage.local.get(['prompts'], (result: any) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          const prompts: Prompt[] = result && Array.isArray(result.prompts) ? result.prompts : [];
          prompts.push(prompt);
          chrome.storage.local.set({ prompts }, () => {
            if (chrome.runtime && chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
            }
            resolve();
          });
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

