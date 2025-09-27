// content.ts
// Content script: detects command in the ChatGPT textarea, requests prompts, and displays a simple UI
import { Message } from './core/types';

declare const chrome: any;

const TEXTAREA_SELECTOR = '#prompt-textarea';

function createOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.background = 'white';
  overlay.style.border = '1px solid #ccc';
  overlay.style.padding = '8px';
  overlay.style.zIndex = '999999';
  overlay.style.maxHeight = '200px';
  overlay.style.overflow = 'auto';
  overlay.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  return overlay;
}

function removeExistingOverlay() {
  const existing = document.getElementById('spine-prompt-overlay');
  if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
}

function positionOverlay(overlay: HTMLElement, textarea: HTMLTextAreaElement) {
  const rect = textarea.getBoundingClientRect();
  overlay.style.left = `${rect.left + window.scrollX}px`;
  overlay.style.top = `${rect.bottom + window.scrollY + 6}px`;
  overlay.id = 'spine-prompt-overlay';
}

const textarea = document.querySelector(TEXTAREA_SELECTOR) as HTMLTextAreaElement | null;
if (textarea) {
  textarea.addEventListener('input', () => {
    if (textarea.value.endsWith('//')) {
      console.log("CONTENT: Detected '//', sending request for prompts.");
      chrome.runtime.sendMessage({ type: 'GET_PROMPTS_REQUEST' } as Message, (response: Message) => {
        console.log('CONTENT: Received response:', response);
        // Basic validation
        if (!response || response.type !== 'GET_PROMPTS_RESPONSE' || !('payload' in response)) return;

        removeExistingOverlay();
        const overlay = createOverlay();

        const prompts: any[] = (response as any).payload || [];
        if (prompts.length === 0) {
          const empty = document.createElement('div');
          empty.textContent = 'No prompts available.';
          overlay.appendChild(empty);
        }

        prompts.forEach(p => {
          const btn = document.createElement('button');
          btn.textContent = p.name;
          btn.style.display = 'block';
          btn.style.width = '100%';
          btn.style.textAlign = 'left';
          btn.style.margin = '4px 0';
          btn.addEventListener('click', () => {
            // Replace the trailing '//' with the template
            const value = textarea.value;
            const newValue = value.replace(/\/\/$/, p.template);
            textarea.value = newValue;
            // Dispatch input event so any listeners update
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            removeExistingOverlay();
          });
          overlay.appendChild(btn);
        });

        document.body.appendChild(overlay);
        positionOverlay(overlay, textarea);
      });
    }
  });

  // Cleanup overlay on escape or click outside
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') removeExistingOverlay();
  });
  document.addEventListener('click', (e) => {
    const overlay = document.getElementById('spine-prompt-overlay');
    if (!overlay) return;
    if (e.target && overlay.contains(e.target as Node)) return; // inside overlay
    // if click not inside overlay and not the textarea, remove
    if (e.target !== textarea) removeExistingOverlay();
  });

} else {
  console.warn(`CONTENT: Textarea not found using selector ${TEXTAREA_SELECTOR}`);
}
