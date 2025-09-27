// background.ts
// Central router for extension messages (uses MockStorageService for now)
import { ChromeStorageService } from './core/storage-service';
import { Message } from './core/types';

// Minimal shim for the `chrome` global to avoid TypeScript complaints in this sandbox.
// In a real extension build, install `@types/chrome` and remove this shim.
declare const chrome: any;

const storage = new ChromeStorageService();

chrome.runtime.onMessage.addListener((message: Message, sender: any, sendResponse: (response: any) => void) => {
  console.log('BACKGROUND: received message', message);

  switch (message.type) {
    case 'GET_PROMPTS_REQUEST':
      storage.getPrompts().then(prompts => {
        sendResponse({ type: 'GET_PROMPTS_RESPONSE', payload: prompts });
      });
      break;
  }
  return true; // Indicates you'll send a response asynchronously
});
