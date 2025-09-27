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
    // Map-first storage under chrome.storage.local.prompts
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
  };

  // background.ts
  var storage = new ChromeStorageService();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("BACKGROUND: received message", message);
    switch (message.type) {
      case "GET_PROMPTS_REQUEST":
        storage.getPrompts().then((prompts) => {
          sendResponse({ type: "GET_PROMPTS_RESPONSE", payload: prompts });
        });
        break;
      case "SAVE_PROMPT_REQUEST":
        console.log("BACKGROUND: saving prompt", message.payload);
        storage.savePrompt({
          id: "",
          // Will be generated by storage service
          name: message.payload.name,
          template: message.payload.template,
          description: message.payload.description
        }).then(() => {
          console.log("BACKGROUND: prompt saved successfully");
          sendResponse({ type: "SAVE_PROMPT_RESPONSE", payload: { success: true } });
        }).catch((error) => {
          console.error("BACKGROUND: failed to save prompt", error);
          sendResponse({ type: "SAVE_PROMPT_RESPONSE", payload: { success: false, error: error.message } });
        });
        break;
    }
    return true;
  });
})();
//# sourceMappingURL=background.js.map
