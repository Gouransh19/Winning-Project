// core/ui-service.ts
// Interface-first contract for UI-related operations.

import { Prompt, Context } from './types';
import { IAccessibilityService, AccessibilityService } from './accessibility-service';
import { IBrainButtonService, BrainButtonService } from './brain-button-service';

/**
 * Describes the data returned when a user successfully saves a prompt via the UI.
 */
export interface SavePromptUIResult {
  name: string;
  description: string;
  template: string; // The actual prompt text
}

/**
 * Describes the data returned when a user successfully saves a context via the UI.
 */
export interface SaveContextUIResult {
  name: string;
  text: string; // The actual context text
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

  // === Context-related UI ===

  /**
   * Displays the context selector UI near the text area.
   * @param contexts The list of contexts to display.
   * @param onSelect The callback to execute when a user selects a context.
   */
  showContextSelector(contexts: Context[], onSelect: (selectedContext: Context) => void): void;

  /**
   * Hides the context selector UI.
   */
  hideContextSelector(): void;

  /**
   * Displays a modal dialog for saving a new context.
   * @param prefillText The text currently selected, to be used as the context's text.
   * @returns A promise that resolves with the completed context details if the user saves,
   * or resolves with `null` if the user cancels.
   */
  showSaveContextModal(prefillText: string): Promise<SaveContextUIResult | null>;

  /**
   * Shows the brain button near selected text.
   * @param position The position to show the brain button.
   * @param onSave The callback to execute when the brain button is clicked.
   */
  showBrainButton(position: { x: number; y: number }, onSave: () => void): void;

  /**
   * Hides the brain button.
   */
  hideBrainButton(): void;
}

export class UIService implements IUIService {
  private editableEl: (HTMLElement & { innerText: string }) | null = null;
  private accessibilityService: IAccessibilityService;
  private brainButtonService: IBrainButtonService;
  private readonly TEXTAREA_SELECTORS = [
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][aria-multiline="true"]',
    '[contenteditable="true"]',
  ];

  constructor(accessibilityService?: IAccessibilityService, brainButtonService?: IBrainButtonService) {
    this.accessibilityService = accessibilityService || new AccessibilityService();
    this.brainButtonService = brainButtonService || new BrainButtonService();
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
    
    // Add accessibility attributes
    overlay.setAttribute('role', 'listbox');
    overlay.setAttribute('aria-label', 'Prompt selector');
    overlay.setAttribute('aria-expanded', 'true');

    if (prompts.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No prompts available.';
      empty.setAttribute('role', 'status');
      empty.setAttribute('aria-live', 'polite');
      overlay.appendChild(empty);
    }

    prompts.forEach((p, index) => {
      const btn = document.createElement('button');
      btn.textContent = p.name;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-label', `${p.name}: ${p.description || 'No description'}`);
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('tabindex', index === 0 ? '0' : '-1'); // First item is focusable
      
      // Enhanced styling for accessibility
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.style.margin = '4px 0';
      btn.style.padding = '8px 12px';
      btn.style.border = '1px solid transparent';
      btn.style.borderRadius = '4px';
      btn.style.backgroundColor = 'transparent';
      btn.style.cursor = 'pointer';
      
      // Focus styles
      btn.addEventListener('focus', () => {
        btn.style.backgroundColor = '#e3f2fd';
        btn.style.borderColor = '#2196f3';
        btn.setAttribute('aria-selected', 'true');
        // Remove selection from other items
        overlay.querySelectorAll('button').forEach(otherBtn => {
          if (otherBtn !== btn) {
            otherBtn.setAttribute('aria-selected', 'false');
            otherBtn.style.backgroundColor = 'transparent';
            otherBtn.style.borderColor = 'transparent';
          }
        });
      });
      
      btn.addEventListener('blur', () => {
        btn.style.backgroundColor = 'transparent';
        btn.style.borderColor = 'transparent';
      });
      
      btn.addEventListener('click', () => {
        onSelect(p);
        this.hidePromptSelector();
      });
      
      overlay.appendChild(btn);
    });

    // Position the overlay
    this.positionOverlay(overlay);

    document.body.appendChild(overlay);

    // Set up accessibility service
    this.accessibilityService.storeCurrentFocus();
    this.accessibilityService.setupKeyboardNavigation(overlay);
    this.accessibilityService.handleEscapeKey(overlay, () => {
      this.hidePromptSelector();
    });

    // Handle resize and scroll
    this.accessibilityService.handleResize(overlay, () => {
      this.positionOverlay(overlay);
    });
    this.accessibilityService.handleScroll(overlay, () => {
      this.positionOverlay(overlay);
    });

    // Focus first item
    this.accessibilityService.focusFirstElement(overlay);

    // Announce to screen readers
    this.accessibilityService.announceToScreenReader({
      message: `Prompt selector opened with ${prompts.length} prompts. Use arrow keys to navigate, Enter to select, or Escape to close.`,
      priority: 'polite'
    });

    // Add click outside to close
    const onClick = (e: MouseEvent) => {
      if (e.target && overlay.contains(e.target as Node)) return; // Click was inside
      if (e.target !== this.editableEl) {
        this.hidePromptSelector();
        document.removeEventListener('click', onClick);
      }
    };
    document.addEventListener('click', onClick, { capture: true });
  }

  hidePromptSelector(): void {
    const existing = document.getElementById('spine-prompt-overlay');
    if (existing && existing.parentElement) {
      // Clean up accessibility service
      this.accessibilityService.cleanup(existing);
      
      // Restore focus
      this.accessibilityService.restoreFocus();
      
      // Remove from DOM
      existing.parentElement.removeChild(existing);
      
      // Announce to screen readers
      this.accessibilityService.announceToScreenReader({
        message: 'Prompt selector closed',
        priority: 'polite'
      });
    }
  }

  private positionOverlay(overlay: HTMLElement): void {
    if (!this.editableEl) return;

    const rect = this.editableEl.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    
    // Calculate position
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 6;
    
    // Check if overlay fits in viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust horizontal position if needed
    if (left + overlayRect.width > viewportWidth) {
      left = viewportWidth - overlayRect.width - 10;
    }
    
    // Adjust vertical position if needed
    if (top + overlayRect.height > viewportHeight + window.scrollY) {
      top = rect.top + window.scrollY - overlayRect.height - 6;
    }
    
    // Ensure minimum margins
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
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
        <h2 id="modal-title" style="margin: 0 0 16px 0; color: #333;">Save Prompt</h2>
        <div style="margin-bottom: 16px;">
          <label for="prompt-name" style="display: block; margin-bottom: 4px; font-weight: 500;">Name:</label>
          <input type="text" id="prompt-name" aria-describedby="name-help" placeholder="Enter prompt name" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          <div id="name-help" style="font-size: 12px; color: #666; margin-top: 4px;">A short, descriptive name for your prompt</div>
        </div>
        <div style="margin-bottom: 16px;">
          <label for="prompt-description" style="display: block; margin-bottom: 4px; font-weight: 500;">Description:</label>
          <input type="text" id="prompt-description" aria-describedby="description-help" placeholder="Enter description (optional)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          <div id="description-help" style="font-size: 12px; color: #666; margin-top: 4px;">Optional description to help you remember what this prompt does</div>
        </div>
        <div style="margin-bottom: 16px;">
          <label for="prompt-template" style="display: block; margin-bottom: 4px; font-weight: 500;">Template:</label>
          <textarea id="prompt-template" readonly aria-describedby="template-help" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; min-height: 80px; resize: vertical; background-color: #f9f9f9;">${prefillText}</textarea>
          <div id="template-help" style="font-size: 12px; color: #666; margin-top: 4px;">The prompt template that will be inserted when selected</div>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="cancel-btn" aria-describedby="cancel-help" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="save-btn" aria-describedby="save-help" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">Save</button>
        </div>
        <div id="cancel-help" style="display: none;">Close the modal without saving</div>
        <div id="save-help" style="display: none;">Save the prompt and close the modal</div>
      `;

      // Add accessibility attributes to modal
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-labelledby', 'modal-title');
      modal.setAttribute('aria-modal', 'true');
      overlay.setAttribute('role', 'presentation');

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Event handlers
      const cleanup = () => {
        // Clean up accessibility service
        this.accessibilityService.cleanup(modal);
        
        // Restore focus
        this.accessibilityService.restoreFocus();
        
        if (overlay.parentElement) {
          overlay.parentElement.removeChild(overlay);
        }
      };

      const handleSave = () => {
        const name = (modal.querySelector('#prompt-name') as HTMLInputElement).value.trim();
        const description = (modal.querySelector('#prompt-description') as HTMLInputElement).value.trim();
        
        if (!name) {
          // Announce validation error
          this.accessibilityService.announceToScreenReader({
            message: 'Please enter a name for the prompt',
            priority: 'assertive'
          });
          
          // Focus the name input and highlight it
          const nameInput = modal.querySelector('#prompt-name') as HTMLInputElement;
          nameInput.focus();
          nameInput.style.borderColor = '#dc3545';
          nameInput.style.borderWidth = '2px';
          
          // Clear the error styling after a delay
          setTimeout(() => {
            nameInput.style.borderColor = '#ddd';
            nameInput.style.borderWidth = '1px';
          }, 3000);
          
          return;
        }

        // Announce successful save
        this.accessibilityService.announceToScreenReader({
          message: `Prompt "${name}" saved successfully`,
          priority: 'polite'
        });

        cleanup();
        resolve({
          name,
          description,
          template: prefillText
        });
      };

      const handleCancel = () => {
        // Announce cancellation
        this.accessibilityService.announceToScreenReader({
          message: 'Save prompt cancelled',
          priority: 'polite'
        });

        cleanup();
        resolve(null);
      };

      // Set up accessibility service after handlers are defined
      this.accessibilityService.storeCurrentFocus();
      this.accessibilityService.setupKeyboardNavigation(modal);
      this.accessibilityService.handleEscapeKey(modal, handleCancel);

      // Focus the name input
      const nameInput = modal.querySelector('#prompt-name') as HTMLInputElement;
      nameInput.focus();

      // Announce modal opening
      this.accessibilityService.announceToScreenReader({
        message: 'Save prompt modal opened. Fill in the name and description, then press Save or Cancel.',
        priority: 'assertive'
      });

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

  // === Context-related UI Implementation ===

  showContextSelector(contexts: Context[], onSelect: (selectedContext: Context) => void): void {
    this.hideContextSelector(); // Ensure no old selector exists
    if (!this.editableEl) return;

    const overlay = this.createContextOverlay();
    
    // Add accessibility attributes
    overlay.setAttribute('role', 'listbox');
    overlay.setAttribute('aria-label', 'Context selector');
    overlay.setAttribute('aria-expanded', 'true');

    if (contexts.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No contexts available.';
      empty.setAttribute('role', 'status');
      empty.setAttribute('aria-live', 'polite');
      overlay.appendChild(empty);
    }

    contexts.forEach((c, index) => {
      const btn = document.createElement('button');
      btn.textContent = c.name;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-label', `${c.name}: ${c.text.substring(0, 50)}${c.text.length > 50 ? '...' : ''}`);
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('tabindex', index === 0 ? '0' : '-1');
      
      // Enhanced styling for accessibility
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.style.margin = '4px 0';
      btn.style.padding = '8px 12px';
      btn.style.border = '1px solid transparent';
      btn.style.borderRadius = '4px';
      btn.style.backgroundColor = 'transparent';
      btn.style.cursor = 'pointer';
      
      // Focus styles
      btn.addEventListener('focus', () => {
        btn.style.backgroundColor = '#e3f2fd';
        btn.style.borderColor = '#2196f3';
        btn.setAttribute('aria-selected', 'true');
        // Remove selection from other items
        overlay.querySelectorAll('button').forEach(otherBtn => {
          if (otherBtn !== btn) {
            otherBtn.setAttribute('aria-selected', 'false');
            otherBtn.style.backgroundColor = 'transparent';
            otherBtn.style.borderColor = 'transparent';
          }
        });
      });
      
      btn.addEventListener('blur', () => {
        btn.style.backgroundColor = 'transparent';
        btn.style.borderColor = 'transparent';
      });
      
      btn.addEventListener('click', () => {
        onSelect(c);
        this.hideContextSelector();
      });
      
      overlay.appendChild(btn);
    });

    // Position the overlay
    this.positionOverlay(overlay);

    document.body.appendChild(overlay);

    // Set up accessibility service
    this.accessibilityService.storeCurrentFocus();
    this.accessibilityService.setupKeyboardNavigation(overlay);
    this.accessibilityService.handleEscapeKey(overlay, () => {
      this.hideContextSelector();
    });

    // Handle resize and scroll
    this.accessibilityService.handleResize(overlay, () => {
      this.positionOverlay(overlay);
    });
    this.accessibilityService.handleScroll(overlay, () => {
      this.positionOverlay(overlay);
    });

    // Focus first item
    this.accessibilityService.focusFirstElement(overlay);

    // Announce to screen readers
    this.accessibilityService.announceToScreenReader({
      message: `Context selector opened with ${contexts.length} contexts. Use arrow keys to navigate, Enter to select, or Escape to close.`,
      priority: 'polite'
    });

    // Add click outside to close
    const onClick = (e: MouseEvent) => {
      if (e.target && overlay.contains(e.target as Node)) return; // Click was inside
      if (e.target !== this.editableEl) {
        this.hideContextSelector();
        document.removeEventListener('click', onClick);
      }
    };
    document.addEventListener('click', onClick, { capture: true });
  }

  hideContextSelector(): void {
    const existing = document.getElementById('spine-context-overlay');
    if (existing && existing.parentElement) {
      // Clean up accessibility service
      this.accessibilityService.cleanup(existing);
      
      // Restore focus
      this.accessibilityService.restoreFocus();
      
      // Remove from DOM
      existing.parentElement.removeChild(existing);
      
      // Announce to screen readers
      this.accessibilityService.announceToScreenReader({
        message: 'Context selector closed',
        priority: 'polite'
      });
    }
  }

  showSaveContextModal(prefillText: string): Promise<SaveContextUIResult | null> {
    const modalId = 'context-save-modal';
    if (document.getElementById(modalId)) {
      return Promise.resolve(null);
    }

    return new Promise<SaveContextUIResult | null>((resolve) => {
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
        <h2 id="context-modal-title" style="margin: 0 0 16px 0; color: #333;">Save Context</h2>
        <div style="margin-bottom: 16px;">
          <label for="context-name" style="display: block; margin-bottom: 4px; font-weight: 500;">Name:</label>
          <input type="text" id="context-name" aria-describedby="context-name-help" placeholder="Enter context name" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          <div id="context-name-help" style="font-size: 12px; color: #666; margin-top: 4px;">A short, descriptive name for your context</div>
        </div>
        <div style="margin-bottom: 16px;">
          <label for="context-text" style="display: block; margin-bottom: 4px; font-weight: 500;">Text:</label>
          <textarea id="context-text" readonly aria-describedby="context-text-help" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; min-height: 120px; resize: vertical; background-color: #f9f9f9;">${prefillText}</textarea>
          <div id="context-text-help" style="font-size: 12px; color: #666; margin-top: 4px;">The context text that will be inserted when selected</div>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="context-cancel-btn" aria-describedby="context-cancel-help" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Cancel</button>
          <button id="context-save-btn" aria-describedby="context-save-help" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">Save</button>
        </div>
        <div id="context-cancel-help" style="display: none;">Close the modal without saving</div>
        <div id="context-save-help" style="display: none;">Save the context and close the modal</div>
      `;

      // Add accessibility attributes to modal
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-labelledby', 'context-modal-title');
      modal.setAttribute('aria-modal', 'true');
      overlay.setAttribute('role', 'presentation');

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Event handlers
      const cleanup = () => {
        // Clean up accessibility service
        this.accessibilityService.cleanup(modal);
        
        // Restore focus
        this.accessibilityService.restoreFocus();
        
        if (overlay.parentElement) {
          overlay.parentElement.removeChild(overlay);
        }
      };

      const handleSave = () => {
        const name = (modal.querySelector('#context-name') as HTMLInputElement).value.trim();
        
        if (!name) {
          // Announce validation error
          this.accessibilityService.announceToScreenReader({
            message: 'Please enter a name for the context',
            priority: 'assertive'
          });
          
          // Focus the name input and highlight it
          const nameInput = modal.querySelector('#context-name') as HTMLInputElement;
          nameInput.focus();
          nameInput.style.borderColor = '#dc3545';
          nameInput.style.borderWidth = '2px';
          
          // Clear the error styling after a delay
          setTimeout(() => {
            nameInput.style.borderColor = '#ddd';
            nameInput.style.borderWidth = '1px';
          }, 3000);
          
          return;
        }

        // Announce successful save
        this.accessibilityService.announceToScreenReader({
          message: `Context "${name}" saved successfully`,
          priority: 'polite'
        });

        cleanup();
        resolve({
          name,
          text: prefillText
        });
      };

      const handleCancel = () => {
        // Announce cancellation
        this.accessibilityService.announceToScreenReader({
          message: 'Save context cancelled',
          priority: 'polite'
        });

        cleanup();
        resolve(null);
      };

      // Set up accessibility service after handlers are defined
      this.accessibilityService.storeCurrentFocus();
      this.accessibilityService.setupKeyboardNavigation(modal);
      this.accessibilityService.handleEscapeKey(modal, handleCancel);

      // Focus the name input
      const nameInput = modal.querySelector('#context-name') as HTMLInputElement;
      nameInput.focus();

      // Announce modal opening
      this.accessibilityService.announceToScreenReader({
        message: 'Save context modal opened. Fill in the name, then press Save or Cancel.',
        priority: 'assertive'
      });

      // Add event listeners
      modal.querySelector('#context-save-btn')?.addEventListener('click', handleSave);
      modal.querySelector('#context-cancel-btn')?.addEventListener('click', handleCancel);
      
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

  showBrainButton(position: { x: number; y: number }, onSave: () => void): void {
    this.brainButtonService.show(position, onSave);
  }

  hideBrainButton(): void {
    this.brainButtonService.hide();
  }

  private createContextOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.background = 'white';
    overlay.style.border = '1px solid #ccc';
    overlay.style.padding = '8px';
    overlay.style.zIndex = '999999';
    overlay.style.maxHeight = '200px';
    overlay.style.overflow = 'auto';
    overlay.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    overlay.id = 'spine-context-overlay';
    return overlay;
  }
}