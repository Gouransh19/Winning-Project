"use strict";
(() => {
  // core/ui-service.ts
  var UIService = class {
    constructor() {
      this.editableEl = null;
      this.TEXTAREA_SELECTORS = [
        '[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"][aria-multiline="true"]',
        '[contenteditable="true"]'
      ];
      this.findEditable();
      if (!this.editableEl) {
        console.warn("UIService: Editable input not found on init; observing DOM.");
        const mo = new MutationObserver(() => {
          if (this.findEditable()) {
            console.log("UIService: Found editable input via MutationObserver.");
            mo.disconnect();
          }
        });
        mo.observe(document.body, { childList: true, subtree: true });
      }
    }
    // === Private DOM Helpers ===
    findEditable() {
      for (const sel of this.TEXTAREA_SELECTORS) {
        const el = document.querySelector(sel);
        if (el) {
          this.editableEl = el;
          return true;
        }
      }
      return false;
    }
    createOverlay() {
      const overlay = document.createElement("div");
      overlay.style.position = "absolute";
      overlay.style.background = "white";
      overlay.style.border = "1px solid #ccc";
      overlay.style.padding = "8px";
      overlay.style.zIndex = "999999";
      overlay.style.maxHeight = "200px";
      overlay.style.overflow = "auto";
      overlay.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
      overlay.id = "spine-prompt-overlay";
      return overlay;
    }
    // === IUIService Implementation ===
    onTextAreaInput(callback) {
      if (!this.editableEl) {
        const mo = new MutationObserver(() => {
          if (this.findEditable()) {
            this.editableEl.addEventListener("input", () => callback(this.getTextAreaValue()));
            mo.disconnect();
          }
        });
        mo.observe(document.body, { childList: true, subtree: true });
        return;
      }
      this.editableEl.addEventListener("input", () => {
        callback(this.getTextAreaValue());
      });
    }
    getTextAreaValue() {
      var _a;
      return ((_a = this.editableEl) == null ? void 0 : _a.innerText) || "";
    }
    setTextAreaValue(text) {
      if (this.editableEl) {
        this.editableEl.innerText = text;
        this.editableEl.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    }
    showPromptSelector(prompts, onSelect) {
      this.hidePromptSelector();
      if (!this.editableEl) return;
      const overlay = this.createOverlay();
      if (prompts.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = "No prompts available.";
        overlay.appendChild(empty);
      }
      prompts.forEach((p) => {
        const btn = document.createElement("button");
        btn.textContent = p.name;
        btn.style.display = "block";
        btn.style.width = "100%";
        btn.style.textAlign = "left";
        btn.style.margin = "4px 0";
        btn.addEventListener("click", () => {
          onSelect(p);
          this.hidePromptSelector();
        });
        overlay.appendChild(btn);
      });
      const rect = this.editableEl.getBoundingClientRect();
      overlay.style.left = "".concat(rect.left + window.scrollX, "px");
      overlay.style.top = "".concat(rect.bottom + window.scrollY + 6, "px");
      document.body.appendChild(overlay);
      const onKey = (e) => {
        if (e.key === "Escape") {
          this.hidePromptSelector();
          window.removeEventListener("keydown", onKey);
        }
      };
      const onClick = (e) => {
        if (e.target && overlay.contains(e.target)) return;
        if (e.target !== this.editableEl) {
          this.hidePromptSelector();
          document.removeEventListener("click", onClick);
        }
      };
      window.addEventListener("keydown", onKey);
      document.addEventListener("click", onClick, { capture: true });
    }
    hidePromptSelector() {
      const existing = document.getElementById("spine-prompt-overlay");
      if (existing && existing.parentElement) {
        existing.parentElement.removeChild(existing);
      }
    }
    showSavePromptModal(prefillText) {
      const modalId = "prompt-save-modal";
      if (document.getElementById(modalId)) {
        return Promise.resolve(null);
      }
      return new Promise((resolve) => {
        var _a, _b;
        const overlay = document.createElement("div");
        overlay.id = modalId;
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        overlay.style.zIndex = "999999";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        const modal = document.createElement("div");
        modal.style.backgroundColor = "white";
        modal.style.padding = "24px";
        modal.style.borderRadius = "8px";
        modal.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.15)";
        modal.style.minWidth = "400px";
        modal.style.maxWidth = "600px";
        modal.innerHTML = '\n        <h2 style="margin: 0 0 16px 0; color: #333;">Save Prompt</h2>\n        <div style="margin-bottom: 16px;">\n          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Name:</label>\n          <input type="text" id="prompt-name" placeholder="Enter prompt name" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">\n        </div>\n        <div style="margin-bottom: 16px;">\n          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Description:</label>\n          <input type="text" id="prompt-description" placeholder="Enter description (optional)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">\n        </div>\n        <div style="margin-bottom: 16px;">\n          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Template:</label>\n          <textarea id="prompt-template" readonly style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; min-height: 80px; resize: vertical; background-color: #f9f9f9;">'.concat(prefillText, '</textarea>\n        </div>\n        <div style="display: flex; gap: 8px; justify-content: flex-end;">\n          <button id="cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>\n          <button id="save-btn" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">Save</button>\n        </div>\n      ');
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        const nameInput = modal.querySelector("#prompt-name");
        nameInput.focus();
        const cleanup = () => {
          if (overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
          }
        };
        const handleSave = () => {
          const name = modal.querySelector("#prompt-name").value.trim();
          const description = modal.querySelector("#prompt-description").value.trim();
          if (!name) {
            alert("Please enter a name for the prompt");
            return;
          }
          cleanup();
          resolve({
            name,
            description,
            template: prefillText
          });
        };
        const handleCancel = () => {
          cleanup();
          resolve(null);
        };
        (_a = modal.querySelector("#save-btn")) == null ? void 0 : _a.addEventListener("click", handleSave);
        (_b = modal.querySelector("#cancel-btn")) == null ? void 0 : _b.addEventListener("click", handleCancel);
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
            handleCancel();
          }
        });
        const handleKeydown = (e) => {
          if (e.key === "Escape") {
            handleCancel();
            document.removeEventListener("keydown", handleKeydown);
          }
        };
        document.addEventListener("keydown", handleKeydown);
        const handleEnter = (e) => {
          if (e.key === "Enter" && e.ctrlKey) {
            handleSave();
          }
        };
        document.addEventListener("keydown", handleEnter);
      });
    }
    showSuccessToast(message) {
      const existingToast = document.getElementById("spine-success-toast");
      if (existingToast && existingToast.parentElement) {
        existingToast.parentElement.removeChild(existingToast);
      }
      const toast = document.createElement("div");
      toast.id = "spine-success-toast";
      toast.textContent = message;
      toast.style.position = "fixed";
      toast.style.top = "20px";
      toast.style.right = "20px";
      toast.style.backgroundColor = "#28a745";
      toast.style.color = "white";
      toast.style.padding = "12px 16px";
      toast.style.borderRadius = "4px";
      toast.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
      toast.style.zIndex = "999999";
      toast.style.fontSize = "14px";
      toast.style.fontWeight = "500";
      toast.style.maxWidth = "300px";
      toast.style.wordWrap = "break-word";
      document.body.appendChild(toast);
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      }, 3e3);
    }
  };

  // content.ts
  var ui = new UIService();
  ui.onTextAreaInput((text) => {
    if (text.endsWith("//")) {
      console.log("CONTENT: Detected '//', requesting prompts.");
      chrome.runtime.sendMessage({ type: "GET_PROMPTS_REQUEST" }, (response) => {
        console.log("CONTENT: Received response:", response);
        if ((response == null ? void 0 : response.type) !== "GET_PROMPTS_RESPONSE" || !("payload" in response)) {
          return;
        }
        const prompts = response.payload || [];
        ui.showPromptSelector(prompts, (selectedPrompt) => {
          const currentText = ui.getTextAreaValue();
          const newText = currentText.replace(/\/\/$/, selectedPrompt.template);
          ui.setTextAreaValue(newText);
        });
      });
    } else if (text.endsWith("+")) {
      console.log("CONTENT: Detected '+', opening save prompt modal.");
      const promptText = text.slice(0, -1).trim();
      if (!promptText) {
        console.log("CONTENT: No text to save, ignoring '+' command.");
        return;
      }
      ui.showSavePromptModal(promptText).then((result) => {
        if (result) {
          console.log("CONTENT: User wants to save prompt:", result);
          chrome.runtime.sendMessage({
            type: "SAVE_PROMPT_REQUEST",
            payload: result
          }, (response) => {
            var _a, _b, _c;
            console.log("CONTENT: Save response:", response);
            if ((response == null ? void 0 : response.type) === "SAVE_PROMPT_RESPONSE") {
              const saveResponse = response;
              if ((_a = saveResponse.payload) == null ? void 0 : _a.success) {
                ui.showSuccessToast("Prompt saved successfully!");
                const currentText = ui.getTextAreaValue();
                const newText = currentText.replace(/\+$/, "");
                ui.setTextAreaValue(newText);
              } else {
                console.error("CONTENT: Failed to save prompt:", (_b = saveResponse.payload) == null ? void 0 : _b.error);
                ui.showSuccessToast("Failed to save prompt: " + (((_c = saveResponse.payload) == null ? void 0 : _c.error) || "Unknown error"));
              }
            }
          });
        } else {
          console.log("CONTENT: User cancelled save prompt modal.");
          const currentText = ui.getTextAreaValue();
          const newText = currentText.replace(/\+$/, "");
          ui.setTextAreaValue(newText);
        }
      });
    } else {
      ui.hidePromptSelector();
    }
  });
})();
//# sourceMappingURL=content.js.map
