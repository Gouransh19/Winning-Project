// core/accessibility-service.ts
// Interface-first contract for accessibility and keyboard navigation

/**
 * Configuration for accessibility features
 */
export interface AccessibilityConfig {
  enableKeyboardNavigation: boolean;
  enableScreenReader: boolean;
  enableFocusManagement: boolean;
  announceActions: boolean;
  highContrastMode: boolean;
}

/**
 * Default accessibility configuration
 */
export const DEFAULT_ACCESSIBILITY_CONFIG: AccessibilityConfig = {
  enableKeyboardNavigation: true,
  enableScreenReader: true,
  enableFocusManagement: true,
  announceActions: true,
  highContrastMode: false
};

/**
 * Interface for keyboard navigation events
 * Note: This extends the native DOM KeyboardEvent with additional properties if needed
 */
export interface CustomKeyboardEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/**
 * Interface for focus management
 */
export interface FocusState {
  previousElement: HTMLElement | null;
  currentElement: HTMLElement | null;
  trapContainer: HTMLElement | null;
}

/**
 * Interface for accessibility announcements
 */
export interface AccessibilityAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  timeout?: number;
}

/**
 * Interface for accessibility service
 */
export interface IAccessibilityService {
  /**
   * Set up keyboard navigation for a container element
   * @param container The container element to add keyboard navigation to
   * @param config Optional configuration override
   */
  setupKeyboardNavigation(container: HTMLElement, config?: Partial<AccessibilityConfig>): void;

  /**
   * Handle tab navigation within a container
   * @param container The container element
   * @param direction Forward or backward navigation
   * @param trapFocus Whether to trap focus within container
   */
  handleTabNavigation(container: HTMLElement, direction: 'forward' | 'backward', trapFocus?: boolean): void;

  /**
   * Handle arrow key navigation for list items
   * @param container The container with selectable items
   * @param direction Up, down, left, or right
   */
  handleArrowNavigation(container: HTMLElement, direction: 'up' | 'down' | 'left' | 'right'): void;

  /**
   * Handle escape key to close modal or return focus
   * @param container The container to handle escape for
   * @param onEscape Callback to execute on escape
   */
  handleEscapeKey(container: HTMLElement, onEscape: () => void): void;

  /**
   * Restore focus to previously focused element
   * @param fallbackElement Element to focus if no previous element
   */
  restoreFocus(fallbackElement?: HTMLElement): void;

  /**
   * Announce message to screen readers
   * @param announcement The announcement to make
   */
  announceToScreenReader(announcement: AccessibilityAnnouncement): void;

  /**
   * Get all focusable elements within a container
   * @param container The container to search within
   * @returns Array of focusable elements
   */
  getFocusableElements(container: HTMLElement): HTMLElement[];

  /**
   * Set focus to first focusable element in container
   * @param container The container to focus within
   */
  focusFirstElement(container: HTMLElement): void;

  /**
   * Set focus to last focusable element in container
   * @param container The container to focus within
   */
  focusLastElement(container: HTMLElement): void;

  /**
   * Handle window resize events for responsive positioning
   * @param element The element to reposition
   * @param onResize Callback to handle resize
   */
  handleResize(element: HTMLElement, onResize: () => void): void;

  /**
   * Handle scroll events for UI positioning
   * @param element The element to reposition
   * @param onScroll Callback to handle scroll
   */
  handleScroll(element: HTMLElement, onScroll: () => void): void;

  /**
   * Clean up event listeners
   * @param container The container to clean up
   */
  cleanup(container: HTMLElement): void;

  /**
   * Store the currently focused element before opening a modal
   */
  storeCurrentFocus(): void;
}

/**
 * Utility function to check if an element is focusable
 */
export const isFocusable = (element: HTMLElement): boolean => {
  const tagName = element.tagName.toLowerCase();
  const tabIndex = element.getAttribute('tabindex');
  
  // Elements that are naturally focusable
  const naturallyFocusable = ['input', 'select', 'textarea', 'button', 'a'];
  
  if (naturallyFocusable.includes(tagName)) {
    return !element.hasAttribute('disabled') && !element.hasAttribute('readonly');
  }
  
  // Elements with tabindex
  if (tabIndex !== null) {
    return parseInt(tabIndex) >= 0;
  }
  
  // Elements with role that should be focusable
  const role = element.getAttribute('role');
  const focusableRoles = ['button', 'link', 'menuitem', 'tab', 'option', 'checkbox', 'radio'];
  
  return role !== null && focusableRoles.includes(role);
};

/**
 * Utility function to get the next focusable element
 */
export const getNextFocusableElement = (
  container: HTMLElement, 
  currentElement: HTMLElement, 
  direction: 'forward' | 'backward' = 'forward'
): HTMLElement | null => {
  const focusableElements = Array.from(container.querySelectorAll('*'))
    .filter((el): el is HTMLElement => el instanceof HTMLElement && isFocusable(el));
  
  const currentIndex = focusableElements.indexOf(currentElement);
  
  if (direction === 'forward') {
    return focusableElements[currentIndex + 1] || focusableElements[0];
  } else {
    return focusableElements[currentIndex - 1] || focusableElements[focusableElements.length - 1];
  }
};

/**
 * Utility function to create a live region for screen reader announcements
 */
export const createLiveRegion = (): HTMLElement => {
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.style.position = 'absolute';
  liveRegion.style.left = '-10000px';
  liveRegion.style.width = '1px';
  liveRegion.style.height = '1px';
  liveRegion.style.overflow = 'hidden';
  document.body.appendChild(liveRegion);
  return liveRegion;
};

/**
 * Accessibility service implementation
 */
export class AccessibilityService implements IAccessibilityService {
  private focusState: FocusState = {
    previousElement: null,
    currentElement: null,
    trapContainer: null
  };
  private config: AccessibilityConfig;
  private liveRegion: HTMLElement;
  private eventListeners: Map<HTMLElement, Array<() => void>> = new Map();

  constructor(config: AccessibilityConfig = DEFAULT_ACCESSIBILITY_CONFIG) {
    this.config = config;
    this.liveRegion = createLiveRegion();
  }

  setupKeyboardNavigation(container: HTMLElement, config?: Partial<AccessibilityConfig>): void {
    const effectiveConfig = { ...this.config, ...config };
    
    // Store the container for focus trapping
    this.focusState.trapContainer = container;
    
    // Set up keyboard event listener
    const keyboardHandler = (event: globalThis.KeyboardEvent) => {
      this.handleKeyboardEvent(container, event, effectiveConfig);
    };
    
    container.addEventListener('keydown', keyboardHandler);
    this.addEventListener(container, () => container.removeEventListener('keydown', keyboardHandler));
  }

  handleTabNavigation(container: HTMLElement, direction: 'forward' | 'backward', trapFocus: boolean = true): void {
    const currentElement = document.activeElement as HTMLElement;
    const nextElement = getNextFocusableElement(container, currentElement, direction);
    
    if (nextElement) {
      nextElement.focus();
      this.focusState.currentElement = nextElement;
    } else if (trapFocus) {
      // Wrap around to first/last element
      const focusableElements = this.getFocusableElements(container);
      if (focusableElements.length > 0) {
        const targetElement = direction === 'forward' ? focusableElements[0] : focusableElements[focusableElements.length - 1];
        targetElement.focus();
        this.focusState.currentElement = targetElement;
      }
    }
  }

  handleArrowNavigation(container: HTMLElement, direction: 'up' | 'down' | 'left' | 'right'): void {
    const currentElement = document.activeElement as HTMLElement;
    const selectableItems = container.querySelectorAll('[role="option"], [role="menuitem"], button');
    const items = Array.from(selectableItems) as HTMLElement[];
    
    if (items.length === 0) return;
    
    const currentIndex = items.indexOf(currentElement);
    let nextIndex = currentIndex;
    
    switch (direction) {
      case 'down':
      case 'right':
        nextIndex = (currentIndex + 1) % items.length;
        break;
      case 'up':
      case 'left':
        nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        break;
    }
    
    if (nextIndex !== currentIndex && items[nextIndex]) {
      items[nextIndex].focus();
      this.focusState.currentElement = items[nextIndex];
    }
  }

  handleEscapeKey(container: HTMLElement, onEscape: () => void): void {
    const escapeHandler = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
      }
    };
    
    container.addEventListener('keydown', escapeHandler);
    this.addEventListener(container, () => container.removeEventListener('keydown', escapeHandler));
  }

  restoreFocus(fallbackElement?: HTMLElement): void {
    const targetElement = this.focusState.previousElement || fallbackElement;
    
    if (targetElement && typeof targetElement.focus === 'function') {
      targetElement.focus();
      this.focusState.currentElement = targetElement;
    }
    
    // Clear the previous element
    this.focusState.previousElement = null;
  }

  announceToScreenReader(announcement: AccessibilityAnnouncement): void {
    if (!this.config.enableScreenReader || !this.config.announceActions) return;
    
    // Clear previous announcement
    this.liveRegion.textContent = '';
    
    // Set the new announcement
    setTimeout(() => {
      this.liveRegion.setAttribute('aria-live', announcement.priority);
      this.liveRegion.textContent = announcement.message;
      
      // Clear after timeout if specified
      if (announcement.timeout) {
        setTimeout(() => {
          this.liveRegion.textContent = '';
        }, announcement.timeout);
      }
    }, 100);
  }

  getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll('*'))
      .filter((el): el is HTMLElement => el instanceof HTMLElement && isFocusable(el));
  }

  focusFirstElement(container: HTMLElement): void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
      this.focusState.currentElement = focusableElements[0];
    }
  }

  focusLastElement(container: HTMLElement): void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length > 0) {
      const lastElement = focusableElements[focusableElements.length - 1];
      lastElement.focus();
      this.focusState.currentElement = lastElement;
    }
  }

  handleResize(element: HTMLElement, onResize: () => void): void {
    const resizeHandler = () => {
      onResize();
    };
    
    window.addEventListener('resize', resizeHandler);
    this.addEventListener(element, () => window.removeEventListener('resize', resizeHandler));
  }

  handleScroll(element: HTMLElement, onScroll: () => void): void {
    const scrollHandler = () => {
      onScroll();
    };
    
    window.addEventListener('scroll', scrollHandler, { passive: true });
    this.addEventListener(element, () => window.removeEventListener('scroll', scrollHandler));
  }

  cleanup(container: HTMLElement): void {
    const listeners = this.eventListeners.get(container);
    if (listeners) {
      listeners.forEach(cleanup => cleanup());
      this.eventListeners.delete(container);
    }
  }

  private handleKeyboardEvent(container: HTMLElement, event: globalThis.KeyboardEvent, config: AccessibilityConfig): void {
    if (!config.enableKeyboardNavigation) return;
    
    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        this.handleTabNavigation(container, event.shiftKey ? 'backward' : 'forward');
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        event.preventDefault();
        const direction = event.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';
        this.handleArrowNavigation(container, direction);
        break;
      case 'Home':
        event.preventDefault();
        this.focusFirstElement(container);
        break;
      case 'End':
        event.preventDefault();
        this.focusLastElement(container);
        break;
    }
  }

  private addEventListener(container: HTMLElement, cleanup: () => void): void {
    if (!this.eventListeners.has(container)) {
      this.eventListeners.set(container, []);
    }
    this.eventListeners.get(container)!.push(cleanup);
  }

  /**
   * Store the currently focused element before opening a modal
   */
  storeCurrentFocus(): void {
    this.focusState.previousElement = document.activeElement as HTMLElement;
  }
}
