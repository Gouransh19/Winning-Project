// core/ui-service.ts
// Interface-first contract for UI-related operations.

import { Prompt } from './types';

/**
 * Describes the data returned when a user successfully saves a prompt via the UI.
 */
export interface SavePromptUIResult {
  name: string;
  description: string;
  template: string; // The actual prompt text
}

/**
 * The contract for a decoupled UI service.
 * This service is responsible for all direct DOM manipulation and user interaction
 * for the extension's UI components (modals, toasts, etc.).
 * It acts as a "brick" that can be tested in isolation and communicates
 * with the rest of the application via promises and callbacks.
 */
export interface IUIService {
  // === Core Text Area Interaction ===

  /**
   * Attaches a listener to the main text area for input events.
   * @param callback The function to call when the user types.
   */
  onTextAreaInput(callback: (text: string) => void): void;

  /**
   * Gets the current text content from the text area.
   * @returns The text content.
   */
  getTextAreaValue(): string;

  /**
   * Sets the text content of the text area.
   * @param text The new text to set.
   */
  setTextAreaValue(text: string): void;

  // === Prompt-related UI ===

  /**
   * Displays the prompt selector UI near the text area.
   * @param prompts The list of prompts to display.
   * @param onSelect The callback to execute when a user selects a prompt.
   */
  showPromptSelector(prompts: Prompt[], onSelect: (selectedPrompt: Prompt) => void): void;

  /**
   * Hides the prompt selector UI.
   */
  hidePromptSelector(): void;

  /**
   * Displays a modal dialog for saving a new prompt.
   * @param prefillText The text currently in the user's input box, to be used as the prompt's template.
   * @returns A promise that resolves with the completed prompt details if the user saves,
   * or resolves with `null` if the user cancels.
   */
  showSavePromptModal(prefillText: string): Promise<SavePromptUIResult | null>;

  /**
   * Shows a short-lived notification toast on the screen.
   * @param message The text to display.
   */
  showSuccessToast(message: string): void;
}

export class UIService implements IUIService {
  private editableEl: (HTMLElement & { innerText: string }) | null = null;
  private readonly TEXTAREA_SELECTORS = [
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][aria-multiline="true"]',
    '[contenteditable="true"]',
  ];

  constructor() {
    this.findEditable();
    if (!this.editableEl) {
      console.warn('UIService: Editable input not found on init; observing DOM.');
      const mo = new MutationObserver(() => {
        if (this.findEditable()) {
          console.log('UIService: Found editable input via MutationObserver.');
          mo.disconnect();
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  // === Private DOM Helpers ===

  private findEditable(): boolean {
    for (const sel of this.TEXTAREA_SELECTORS) {
      const el = document.querySelector(sel) as (HTMLElement & { innerText: string }) | null;
      if (el) {
        this.editableEl = el;
        return true;
      }
    }
    return false;
  }

  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.background = 'white';
    overlay.style.border = '1px solid #ccc';
    overlay.style.padding = '8px';
    overlay.style.zIndex = '999999';
    overlay.style.maxHeight = '200px';
    overlay.style.overflow = 'auto';
    overlay.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    overlay.id = 'spine-prompt-overlay'; // Use a constant for the ID
    return overlay;
  }

  // === IUIService Implementation ===

  onTextAreaInput(callback: (text: string) => void): void {
    if (!this.editableEl) {
      // If the element isn't found immediately, wait for the mutation observer.
      const mo = new MutationObserver(() => {
        if (this.findEditable()) {
          this.editableEl!.addEventListener('input', () => callback(this.getTextAreaValue()));
          mo.disconnect();
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      return;
    }
    this.editableEl.addEventListener('input', () => {
      callback(this.getTextAreaValue());
    });
  }

  getTextAreaValue(): string {
    return this.editableEl?.innerText || '';
  }

  setTextAreaValue(text: string): void {
    if (this.editableEl) {
      this.editableEl.innerText = text;
      // Dispatch input event so site listeners react
      this.editableEl.dispatchEvent(new InputEvent('input', { bubbles: true } as any));
    }
  }

  showPromptSelector(prompts: Prompt[], onSelect: (selectedPrompt: Prompt) => void): void {
    this.hidePromptSelector(); // Ensure no old selector exists
    if (!this.editableEl) return;

    const overlay = this.createOverlay();

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
        onSelect(p);
        this.hidePromptSelector();
      });
      overlay.appendChild(btn);
    });

    const rect = this.editableEl.getBoundingClientRect();
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.top = `${rect.bottom + window.scrollY + 6}px`;

    document.body.appendChild(overlay);

    // Add listeners to close the overlay
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hidePromptSelector();
        window.removeEventListener('keydown', onKey);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (e.target && overlay.contains(e.target as Node)) return; // Click was inside
      if (e.target !== this.editableEl) {
        this.hidePromptSelector();
        document.removeEventListener('click', onClick);
      }
    };

    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick, { capture: true });
  }

  hidePromptSelector(): void {
    const existing = document.getElementById('spine-prompt-overlay');
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
  }

  showSavePromptModal(prefillText: string): Promise<SavePromptUIResult | null> {
    const modalId = 'prompt-save-modal';
    if (document.getElementById(modalId)) {
      return Promise.resolve(null);
    }

    return new Promise<SavePromptUIResult | null>((resolve) => {
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.id = modalId;
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      overlay.style.zIndex = '999999';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';

      // Create modal content
      const modal = document.createElement('div');
      modal.style.backgroundColor = 'white';
      modal.style.padding = '24px';
      modal.style.borderRadius = '8px';
      modal.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
      modal.style.minWidth = '400px';
      modal.style.maxWidth = '600px';

      modal.innerHTML = `
        <h2 style="margin: 0 0 16px 0; color: #333;">Save Prompt</h2>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Name:</label>
          <input type="text" id="prompt-name" placeholder="Enter prompt name" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Description:</label>
          <input type="text" id="prompt-description" placeholder="Enter description (optional)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Template:</label>
          <textarea id="prompt-template" readonly style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; min-height: 80px; resize: vertical; background-color: #f9f9f9;">${prefillText}</textarea>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="save-btn" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">Save</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Focus the name input
      const nameInput = modal.querySelector('#prompt-name') as HTMLInputElement;
      nameInput.focus();

      // Event handlers
      const cleanup = () => {
        if (overlay.parentElement) {
          overlay.parentElement.removeChild(overlay);
        }
      };

      const handleSave = () => {
        const name = (modal.querySelector('#prompt-name') as HTMLInputElement).value.trim();
        const description = (modal.querySelector('#prompt-description') as HTMLInputElement).value.trim();
        
        if (!name) {
          alert('Please enter a name for the prompt');
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

      // Add event listeners
      modal.querySelector('#save-btn')?.addEventListener('click', handleSave);
      modal.querySelector('#cancel-btn')?.addEventListener('click', handleCancel);
      
      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          handleCancel();
        }
      });

      // Close on Escape key
      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCancel();
          document.removeEventListener('keydown', handleKeydown);
        }
      };
      document.addEventListener('keydown', handleKeydown);

      // Enter key to save
      const handleEnter = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
          handleSave();
        }
      };
      document.addEventListener('keydown', handleEnter);
    });
  }

  showSuccessToast(message: string): void {
    // Remove any existing toast
    const existingToast = document.getElementById('spine-success-toast');
    if (existingToast && existingToast.parentElement) {
      existingToast.parentElement.removeChild(existingToast);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'spine-success-toast';
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = '#28a745';
    toast.style.color = 'white';
    toast.style.padding = '12px 16px';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    toast.style.zIndex = '999999';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.maxWidth = '300px';
    toast.style.wordWrap = 'break-word';

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 3000);
  }
}