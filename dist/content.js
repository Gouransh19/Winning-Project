"use strict";
(() => {
  // content.ts
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
    const existing2 = document.getElementById("spine-prompt-overlay");
    if (existing2 && existing2.parentElement) existing2.parentElement.removeChild(existing2);
  }
  function positionOverlay(overlay, textarea) {
    const rect = textarea.getBoundingClientRect();
    overlay.style.left = "".concat(rect.left + window.scrollX, "px");
    overlay.style.top = "".concat(rect.bottom + window.scrollY + 6, "px");
    overlay.id = "spine-prompt-overlay";
  }
  var TEXTAREA_SELECTORS = [
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][aria-multiline="true"]',
    '[contenteditable="true"]'
  ];
  function findEditable() {
    for (const sel of TEXTAREA_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }
  function attachToEditable(editable) {
    const inputHandler = () => {
      const text = (editable.innerText || "").trimEnd();
      if (text.endsWith("//")) {
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
              const value = editable.innerText || "";
              const newValue = value.replace(/\/\/$/, p.template);
              editable.innerText = newValue;
              editable.dispatchEvent(new InputEvent("input", { bubbles: true }));
              removeExistingOverlay();
            });
            overlay.appendChild(btn);
          });
          document.body.appendChild(overlay);
          positionOverlay(overlay, editable);
        });
      }
    };
    editable.addEventListener("input", inputHandler);
    const onKey = (e) => {
      if (e.key === "Escape") removeExistingOverlay();
    };
    const onClick = (e) => {
      const overlay = document.getElementById("spine-prompt-overlay");
      if (!overlay) return;
      if (e.target && overlay.contains(e.target)) return;
      if (e.target !== editable) removeExistingOverlay();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
  }
  var existing = findEditable();
  if (existing) {
    attachToEditable(existing);
  } else {
    console.warn("CONTENT: Editable input not found; observing DOM for contenteditable element.");
    const mo = new MutationObserver((mutations, observer) => {
      const el = findEditable();
      if (el) {
        console.log("CONTENT: Found editable input via MutationObserver. Attaching.");
        attachToEditable(el);
        observer.disconnect();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
//# sourceMappingURL=content.js.map
