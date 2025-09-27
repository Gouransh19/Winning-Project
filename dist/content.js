"use strict";
(() => {
  var __defProp = Object.defineProperty;
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

  // core/accessibility-service.ts
  var DEFAULT_ACCESSIBILITY_CONFIG = {
    enableKeyboardNavigation: true,
    enableScreenReader: true,
    enableFocusManagement: true,
    announceActions: true,
    highContrastMode: false
  };
  var isFocusable = (element) => {
    const tagName = element.tagName.toLowerCase();
    const tabIndex = element.getAttribute("tabindex");
    const naturallyFocusable = ["input", "select", "textarea", "button", "a"];
    if (naturallyFocusable.includes(tagName)) {
      return !element.hasAttribute("disabled") && !element.hasAttribute("readonly");
    }
    if (tabIndex !== null) {
      return parseInt(tabIndex) >= 0;
    }
    const role = element.getAttribute("role");
    const focusableRoles = ["button", "link", "menuitem", "tab", "option", "checkbox", "radio"];
    return role !== null && focusableRoles.includes(role);
  };
  var getNextFocusableElement = (container, currentElement, direction = "forward") => {
    const focusableElements = Array.from(container.querySelectorAll("*")).filter((el) => el instanceof HTMLElement && isFocusable(el));
    const currentIndex = focusableElements.indexOf(currentElement);
    if (direction === "forward") {
      return focusableElements[currentIndex + 1] || focusableElements[0];
    } else {
      return focusableElements[currentIndex - 1] || focusableElements[focusableElements.length - 1];
    }
  };
  var createLiveRegion = () => {
    const liveRegion = document.createElement("div");
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");
    liveRegion.style.position = "absolute";
    liveRegion.style.left = "-10000px";
    liveRegion.style.width = "1px";
    liveRegion.style.height = "1px";
    liveRegion.style.overflow = "hidden";
    document.body.appendChild(liveRegion);
    return liveRegion;
  };
  var AccessibilityService = class {
    constructor(config = DEFAULT_ACCESSIBILITY_CONFIG) {
      this.focusState = {
        previousElement: null,
        currentElement: null,
        trapContainer: null
      };
      this.eventListeners = /* @__PURE__ */ new Map();
      this.config = config;
      this.liveRegion = createLiveRegion();
    }
    setupKeyboardNavigation(container, config) {
      const effectiveConfig = __spreadValues(__spreadValues({}, this.config), config);
      this.focusState.trapContainer = container;
      const keyboardHandler = (event) => {
        this.handleKeyboardEvent(container, event, effectiveConfig);
      };
      container.addEventListener("keydown", keyboardHandler);
      this.addEventListener(container, () => container.removeEventListener("keydown", keyboardHandler));
    }
    handleTabNavigation(container, direction, trapFocus = true) {
      const currentElement = document.activeElement;
      const nextElement = getNextFocusableElement(container, currentElement, direction);
      if (nextElement) {
        nextElement.focus();
        this.focusState.currentElement = nextElement;
      } else if (trapFocus) {
        const focusableElements = this.getFocusableElements(container);
        if (focusableElements.length > 0) {
          const targetElement = direction === "forward" ? focusableElements[0] : focusableElements[focusableElements.length - 1];
          targetElement.focus();
          this.focusState.currentElement = targetElement;
        }
      }
    }
    handleArrowNavigation(container, direction) {
      const currentElement = document.activeElement;
      const selectableItems = container.querySelectorAll('[role="option"], [role="menuitem"], button');
      const items = Array.from(selectableItems);
      if (items.length === 0) return;
      const currentIndex = items.indexOf(currentElement);
      let nextIndex = currentIndex;
      switch (direction) {
        case "down":
        case "right":
          nextIndex = (currentIndex + 1) % items.length;
          break;
        case "up":
        case "left":
          nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
          break;
      }
      if (nextIndex !== currentIndex && items[nextIndex]) {
        items[nextIndex].focus();
        this.focusState.currentElement = items[nextIndex];
      }
    }
    handleEscapeKey(container, onEscape) {
      const escapeHandler = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onEscape();
        }
      };
      container.addEventListener("keydown", escapeHandler);
      this.addEventListener(container, () => container.removeEventListener("keydown", escapeHandler));
    }
    restoreFocus(fallbackElement) {
      const targetElement = this.focusState.previousElement || fallbackElement;
      if (targetElement && typeof targetElement.focus === "function") {
        targetElement.focus();
        this.focusState.currentElement = targetElement;
      }
      this.focusState.previousElement = null;
    }
    announceToScreenReader(announcement) {
      if (!this.config.enableScreenReader || !this.config.announceActions) return;
      this.liveRegion.textContent = "";
      setTimeout(() => {
        this.liveRegion.setAttribute("aria-live", announcement.priority);
        this.liveRegion.textContent = announcement.message;
        if (announcement.timeout) {
          setTimeout(() => {
            this.liveRegion.textContent = "";
          }, announcement.timeout);
        }
      }, 100);
    }
    getFocusableElements(container) {
      return Array.from(container.querySelectorAll("*")).filter((el) => el instanceof HTMLElement && isFocusable(el));
    }
    focusFirstElement(container) {
      const focusableElements = this.getFocusableElements(container);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
        this.focusState.currentElement = focusableElements[0];
      }
    }
    focusLastElement(container) {
      const focusableElements = this.getFocusableElements(container);
      if (focusableElements.length > 0) {
        const lastElement = focusableElements[focusableElements.length - 1];
        lastElement.focus();
        this.focusState.currentElement = lastElement;
      }
    }
    handleResize(element, onResize) {
      const resizeHandler = () => {
        onResize();
      };
      window.addEventListener("resize", resizeHandler);
      this.addEventListener(element, () => window.removeEventListener("resize", resizeHandler));
    }
    handleScroll(element, onScroll) {
      const scrollHandler = () => {
        onScroll();
      };
      window.addEventListener("scroll", scrollHandler, { passive: true });
      this.addEventListener(element, () => window.removeEventListener("scroll", scrollHandler));
    }
    cleanup(container) {
      const listeners = this.eventListeners.get(container);
      if (listeners) {
        listeners.forEach((cleanup) => cleanup());
        this.eventListeners.delete(container);
      }
    }
    handleKeyboardEvent(container, event, config) {
      if (!config.enableKeyboardNavigation) return;
      switch (event.key) {
        case "Tab":
          event.preventDefault();
          this.handleTabNavigation(container, event.shiftKey ? "backward" : "forward");
          break;
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight":
          event.preventDefault();
          const direction = event.key.replace("Arrow", "").toLowerCase();
          this.handleArrowNavigation(container, direction);
          break;
        case "Home":
          event.preventDefault();
          this.focusFirstElement(container);
          break;
        case "End":
          event.preventDefault();
          this.focusLastElement(container);
          break;
      }
    }
    addEventListener(container, cleanup) {
      if (!this.eventListeners.has(container)) {
        this.eventListeners.set(container, []);
      }
      this.eventListeners.get(container).push(cleanup);
    }
    /**
     * Store the currently focused element before opening a modal
     */
    storeCurrentFocus() {
      this.focusState.previousElement = document.activeElement;
    }
  };

  // core/ui-service.ts
  var UIService = class {
    constructor(accessibilityService) {
      this.editableEl = null;
      this.TEXTAREA_SELECTORS = [
        '[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"][aria-multiline="true"]',
        '[contenteditable="true"]'
      ];
      this.accessibilityService = accessibilityService || new AccessibilityService();
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
      overlay.setAttribute("role", "listbox");
      overlay.setAttribute("aria-label", "Prompt selector");
      overlay.setAttribute("aria-expanded", "true");
      if (prompts.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = "No prompts available.";
        empty.setAttribute("role", "status");
        empty.setAttribute("aria-live", "polite");
        overlay.appendChild(empty);
      }
      prompts.forEach((p, index) => {
        const btn = document.createElement("button");
        btn.textContent = p.name;
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-label", "".concat(p.name, ": ").concat(p.description || "No description"));
        btn.setAttribute("aria-selected", "false");
        btn.setAttribute("tabindex", index === 0 ? "0" : "-1");
        btn.style.display = "block";
        btn.style.width = "100%";
        btn.style.textAlign = "left";
        btn.style.margin = "4px 0";
        btn.style.padding = "8px 12px";
        btn.style.border = "1px solid transparent";
        btn.style.borderRadius = "4px";
        btn.style.backgroundColor = "transparent";
        btn.style.cursor = "pointer";
        btn.addEventListener("focus", () => {
          btn.style.backgroundColor = "#e3f2fd";
          btn.style.borderColor = "#2196f3";
          btn.setAttribute("aria-selected", "true");
          overlay.querySelectorAll("button").forEach((otherBtn) => {
            if (otherBtn !== btn) {
              otherBtn.setAttribute("aria-selected", "false");
              otherBtn.style.backgroundColor = "transparent";
              otherBtn.style.borderColor = "transparent";
            }
          });
        });
        btn.addEventListener("blur", () => {
          btn.style.backgroundColor = "transparent";
          btn.style.borderColor = "transparent";
        });
        btn.addEventListener("click", () => {
          onSelect(p);
          this.hidePromptSelector();
        });
        overlay.appendChild(btn);
      });
      this.positionOverlay(overlay);
      document.body.appendChild(overlay);
      this.accessibilityService.storeCurrentFocus();
      this.accessibilityService.setupKeyboardNavigation(overlay);
      this.accessibilityService.handleEscapeKey(overlay, () => {
        this.hidePromptSelector();
      });
      this.accessibilityService.handleResize(overlay, () => {
        this.positionOverlay(overlay);
      });
      this.accessibilityService.handleScroll(overlay, () => {
        this.positionOverlay(overlay);
      });
      this.accessibilityService.focusFirstElement(overlay);
      this.accessibilityService.announceToScreenReader({
        message: "Prompt selector opened with ".concat(prompts.length, " prompts. Use arrow keys to navigate, Enter to select, or Escape to close."),
        priority: "polite"
      });
      const onClick = (e) => {
        if (e.target && overlay.contains(e.target)) return;
        if (e.target !== this.editableEl) {
          this.hidePromptSelector();
          document.removeEventListener("click", onClick);
        }
      };
      document.addEventListener("click", onClick, { capture: true });
    }
    hidePromptSelector() {
      const existing = document.getElementById("spine-prompt-overlay");
      if (existing && existing.parentElement) {
        this.accessibilityService.cleanup(existing);
        this.accessibilityService.restoreFocus();
        existing.parentElement.removeChild(existing);
        this.accessibilityService.announceToScreenReader({
          message: "Prompt selector closed",
          priority: "polite"
        });
      }
    }
    positionOverlay(overlay) {
      if (!this.editableEl) return;
      const rect = this.editableEl.getBoundingClientRect();
      const overlayRect = overlay.getBoundingClientRect();
      let left = rect.left + window.scrollX;
      let top = rect.bottom + window.scrollY + 6;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      if (left + overlayRect.width > viewportWidth) {
        left = viewportWidth - overlayRect.width - 10;
      }
      if (top + overlayRect.height > viewportHeight + window.scrollY) {
        top = rect.top + window.scrollY - overlayRect.height - 6;
      }
      left = Math.max(10, left);
      top = Math.max(10, top);
      overlay.style.left = "".concat(left, "px");
      overlay.style.top = "".concat(top, "px");
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
        modal.innerHTML = '\n        <h2 id="modal-title" style="margin: 0 0 16px 0; color: #333;">Save Prompt</h2>\n        <div style="margin-bottom: 16px;">\n          <label for="prompt-name" style="display: block; margin-bottom: 4px; font-weight: 500;">Name:</label>\n          <input type="text" id="prompt-name" aria-describedby="name-help" placeholder="Enter prompt name" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">\n          <div id="name-help" style="font-size: 12px; color: #666; margin-top: 4px;">A short, descriptive name for your prompt</div>\n        </div>\n        <div style="margin-bottom: 16px;">\n          <label for="prompt-description" style="display: block; margin-bottom: 4px; font-weight: 500;">Description:</label>\n          <input type="text" id="prompt-description" aria-describedby="description-help" placeholder="Enter description (optional)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">\n          <div id="description-help" style="font-size: 12px; color: #666; margin-top: 4px;">Optional description to help you remember what this prompt does</div>\n        </div>\n        <div style="margin-bottom: 16px;">\n          <label for="prompt-template" style="display: block; margin-bottom: 4px; font-weight: 500;">Template:</label>\n          <textarea id="prompt-template" readonly aria-describedby="template-help" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; min-height: 80px; resize: vertical; background-color: #f9f9f9;">'.concat(prefillText, '</textarea>\n          <div id="template-help" style="font-size: 12px; color: #666; margin-top: 4px;">The prompt template that will be inserted when selected</div>\n        </div>\n        <div style="display: flex; gap: 8px; justify-content: flex-end;">\n          <button id="cancel-btn" aria-describedby="cancel-help" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>\n          <button id="save-btn" aria-describedby="save-help" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">Save</button>\n        </div>\n        <div id="cancel-help" style="display: none;">Close the modal without saving</div>\n        <div id="save-help" style="display: none;">Save the prompt and close the modal</div>\n      ');
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-labelledby", "modal-title");
        modal.setAttribute("aria-modal", "true");
        overlay.setAttribute("role", "presentation");
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        const cleanup = () => {
          this.accessibilityService.cleanup(modal);
          this.accessibilityService.restoreFocus();
          if (overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
          }
        };
        const handleSave = () => {
          const name = modal.querySelector("#prompt-name").value.trim();
          const description = modal.querySelector("#prompt-description").value.trim();
          if (!name) {
            this.accessibilityService.announceToScreenReader({
              message: "Please enter a name for the prompt",
              priority: "assertive"
            });
            const nameInput2 = modal.querySelector("#prompt-name");
            nameInput2.focus();
            nameInput2.style.borderColor = "#dc3545";
            nameInput2.style.borderWidth = "2px";
            setTimeout(() => {
              nameInput2.style.borderColor = "#ddd";
              nameInput2.style.borderWidth = "1px";
            }, 3e3);
            return;
          }
          this.accessibilityService.announceToScreenReader({
            message: 'Prompt "'.concat(name, '" saved successfully'),
            priority: "polite"
          });
          cleanup();
          resolve({
            name,
            description,
            template: prefillText
          });
        };
        const handleCancel = () => {
          this.accessibilityService.announceToScreenReader({
            message: "Save prompt cancelled",
            priority: "polite"
          });
          cleanup();
          resolve(null);
        };
        this.accessibilityService.storeCurrentFocus();
        this.accessibilityService.setupKeyboardNavigation(modal);
        this.accessibilityService.handleEscapeKey(modal, handleCancel);
        const nameInput = modal.querySelector("#prompt-name");
        nameInput.focus();
        this.accessibilityService.announceToScreenReader({
          message: "Save prompt modal opened. Fill in the name and description, then press Save or Cancel.",
          priority: "assertive"
        });
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
