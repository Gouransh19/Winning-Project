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
const TEXTAREA_SELECTORS = [
  '[contenteditable="true"][role="textbox"]',
  '[contenteditable="true"][aria-multiline="true"]',
  '[contenteditable="true"]'
];

type EditableEl = HTMLElement & { innerText: string };

function findEditable(): EditableEl | null {
  for (const sel of TEXTAREA_SELECTORS) {
    const el = document.querySelector(sel) as EditableEl | null;
    if (el) return el;
  }
  return null;
}

function attachToEditable(editable: EditableEl) {
  const inputHandler = () => {
    const text = (editable.innerText || '').trimEnd();
    if (text.endsWith('//')) {
      console.log("CONTENT: Detected '//', sending request for prompts.");
      chrome.runtime.sendMessage({ type: 'GET_PROMPTS_REQUEST' } as Message, (response: Message) => {
        console.log('CONTENT: Received response:', response);
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
            // Replace the trailing '//' with the template in innerText
            const value = editable.innerText || '';
            const newValue = value.replace(/\/\/$/, p.template);
            editable.innerText = newValue;
            // Dispatch input event so site listeners react
            editable.dispatchEvent(new InputEvent('input', { bubbles: true } as any));
            removeExistingOverlay();
          });
          overlay.appendChild(btn);
        });

        document.body.appendChild(overlay);
        positionOverlay(overlay, editable as unknown as HTMLTextAreaElement);
      });
    }
  };

  editable.addEventListener('input', inputHandler);

  // Cleanup overlay on escape or click outside
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') removeExistingOverlay(); };
  const onClick = (e: MouseEvent) => {
    const overlay = document.getElementById('spine-prompt-overlay');
    if (!overlay) return;
    if (e.target && overlay.contains(e.target as Node)) return; // inside overlay
    if (e.target !== editable) removeExistingOverlay();
  };
  window.addEventListener('keydown', onKey);
  document.addEventListener('click', onClick);
}

// Try to find the editable immediately; if not found, observe DOM for it
const existing = findEditable();
if (existing) {
  attachToEditable(existing);
} else {
  console.warn('CONTENT: Editable input not found; observing DOM for contenteditable element.');
  const mo = new MutationObserver((mutations, observer) => {
    const el = findEditable();
    if (el) {
      console.log('CONTENT: Found editable input via MutationObserver. Attaching.');
      attachToEditable(el);
      observer.disconnect();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
