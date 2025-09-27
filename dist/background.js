"use strict";
(() => {
  // core/storage-service.ts
  var ChromeStorageService = class {
    // Uses chrome.storage.local to persist prompts under the 'prompts' key
    async getPrompts() {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.get(["prompts"], (result) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
            }
            const prompts = result && Array.isArray(result.prompts) ? result.prompts : [];
            resolve(prompts);
          });
        } catch (err) {
          reject(err);
        }
      });
    }
    async savePrompt(prompt) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.get(["prompts"], (result) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
            }
            const prompts = result && Array.isArray(result.prompts) ? result.prompts : [];
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
  };

  // background.ts
  var storage = new ChromeStorageService();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "GET_PROMPTS_REQUEST":
        storage.getPrompts().then((prompts) => {
          sendResponse({ type: "GET_PROMPTS_RESPONSE", payload: prompts });
        });
        break;
    }
    return true;
  });
})();
//# sourceMappingURL=background.js.map
