// core/selection-service.ts
// Universal text selection detection service

/**
 * Configuration for selection detection
 */
export interface SelectionConfig {
  enableSelectionDetection: boolean;
  minSelectionLength: number;
  debounceMs: number;
  excludeElements: string[];
}

/**
 * Selection bounds information
 */
export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Interface for selection detection service
 */
export interface ISelectionService {
  /**
   * Get currently selected text
   */
  getSelectedText(): string;

  /**
   * Get bounds of current selection
   */
  getSelectionBounds(): SelectionBounds | null;

  /**
   * Check if there is currently a selection
   */
  hasSelection(): boolean;

  /**
   * Listen for selection changes
   */
  onSelectionChange(callback: (hasSelection: boolean, selectedText: string) => void): void;

  /**
   * Clean up event listeners
   */
  cleanup(): void;

  /**
   * Check if selection is in an excluded element
   */
  isSelectionExcluded(): boolean;
}

/**
 * Default selection configuration
 */
export const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  enableSelectionDetection: true,
  minSelectionLength: 1,
  debounceMs: 100,
  excludeElements: ['input', 'textarea', 'select', '[contenteditable="true"]']
};

/**
 * Universal selection detection service
 * Works on any website using standard browser APIs
 */
export class SelectionService implements ISelectionService {
  private config: SelectionConfig;
  private selectionChangeCallbacks: Array<(hasSelection: boolean, selectedText: string) => void> = [];
  private debounceTimer: number | null = null;
  private isListening = false;

  constructor(config: SelectionConfig = DEFAULT_SELECTION_CONFIG) {
    this.config = config;
  }

  getSelectedText(): string {
    if (!this.config.enableSelectionDetection) {
      return '';
    }

    try {
      if (window.getSelection) {
        return window.getSelection()?.toString() || '';
      } else if ((document as any).selection && (document as any).selection.type !== 'Control') {
        return (document as any).selection.createRange().text || '';
      }
    } catch (error) {
      console.warn('SelectionService: Error getting selected text:', error);
    }

    return '';
  }

  getSelectionBounds(): SelectionBounds | null {
    if (!this.config.enableSelectionDetection) {
      return null;
    }

    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return null;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      };
    } catch (error) {
      console.warn('SelectionService: Error getting selection bounds:', error);
      return null;
    }
  }

  hasSelection(): boolean {
    const selectedText = this.getSelectedText();
    return selectedText.length >= this.config.minSelectionLength && !this.isSelectionExcluded();
  }

  onSelectionChange(callback: (hasSelection: boolean, selectedText: string) => void): void {
    this.selectionChangeCallbacks.push(callback);

    if (!this.isListening) {
      this.startListening();
    }
  }

  cleanup(): void {
    this.stopListening();
    this.selectionChangeCallbacks = [];
  }

  isSelectionExcluded(): boolean {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return false;
      }

      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      // Check if selection is inside an excluded element
      for (const selector of this.config.excludeElements) {
        if (container.nodeType === Node.ELEMENT_NODE) {
          const element = container as Element;
          if (element.matches && element.matches(selector)) {
            return true;
          }
          if (element.closest && element.closest(selector)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.warn('SelectionService: Error checking if selection is excluded:', error);
      return false;
    }
  }

  private startListening(): void {
    if (this.isListening) return;

    this.isListening = true;
    
    // Listen for selection changes
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
    
    // Listen for mouse up (when selection is complete)
    document.addEventListener('mouseup', this.handleSelectionChange.bind(this));
    
    // Listen for key up (for keyboard selections)
    document.addEventListener('keyup', this.handleSelectionChange.bind(this));
  }

  private stopListening(): void {
    if (!this.isListening) return;

    this.isListening = false;
    
    document.removeEventListener('selectionchange', this.handleSelectionChange.bind(this));
    document.removeEventListener('mouseup', this.handleSelectionChange.bind(this));
    document.removeEventListener('keyup', this.handleSelectionChange.bind(this));

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private handleSelectionChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      const selectedText = this.getSelectedText();
      const hasSelection = this.hasSelection();

      this.selectionChangeCallbacks.forEach(callback => {
        try {
          callback(hasSelection, selectedText);
        } catch (error) {
          console.warn('SelectionService: Error in selection change callback:', error);
        }
      });
    }, this.config.debounceMs);
  }
}
