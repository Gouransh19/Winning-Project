"use strict";
(() => {
  // content.ts
  var TEXTAREA_SELECTOR = "#prompt-textarea";
  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.background = "white";
    overlay.style.border = "1px solid #ccc";
    overlay.style.padding = "8px";
    overlay.style.zIndex = "999999";
    overlay.style.maxHeight = "200px";
    overlay.style.overflow = "auto";
    overlay.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    return overlay;
  }
  function removeExistingOverlay() {
    const existing = document.getElementById("spine-prompt-overlay");
    if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
  }
  function positionOverlay(overlay, textarea2) {
    const rect = textarea2.getBoundingClientRect();
    overlay.style.left = "".concat(rect.left + window.scrollX, "px");
    overlay.style.top = "".concat(rect.bottom + window.scrollY + 6, "px");
    overlay.id = "spine-prompt-overlay";
  }
  var textarea = document.querySelector(TEXTAREA_SELECTOR);
  if (textarea) {
    textarea.addEventListener("input", () => {
      if (textarea.value.endsWith("//")) {
        console.log("CONTENT: Detected '//', sending request for prompts.");
        chrome.runtime.sendMessage({ type: "GET_PROMPTS_REQUEST" }, (response) => {
          console.log("CONTENT: Received response:", response);
          if (!response || response.type !== "GET_PROMPTS_RESPONSE" || !("payload" in response)) return;
          removeExistingOverlay();
          const overlay = createOverlay();
          const prompts = response.payload || [];
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
              const value = textarea.value;
              const newValue = value.replace(/\/\/$/, p.template);
              textarea.value = newValue;
              textarea.dispatchEvent(new Event("input", { bubbles: true }));
              removeExistingOverlay();
            });
            overlay.appendChild(btn);
          });
          document.body.appendChild(overlay);
          positionOverlay(overlay, textarea);
        });
      }
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") removeExistingOverlay();
    });
    document.addEventListener("click", (e) => {
      const overlay = document.getElementById("spine-prompt-overlay");
      if (!overlay) return;
      if (e.target && overlay.contains(e.target)) return;
      if (e.target !== textarea) removeExistingOverlay();
    });
  } else {
    console.warn("CONTENT: Textarea not found using selector ".concat(TEXTAREA_SELECTOR));
  }
})();
//# sourceMappingURL=content.js.map
