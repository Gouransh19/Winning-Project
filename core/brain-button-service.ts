// core/brain-button-service.ts
// Modular brain button service for context saving

import { IAccessibilityService } from './accessibility-service';

/**
 * Brain button configuration
 */
export interface BrainButtonConfig {
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
  style: 'minimal' | 'fancy' | 'dark' | 'light';
  size: 'small' | 'medium' | 'large';
  animation: 'fade-in' | 'slide-in' | 'bounce' | 'none';
  zIndex: number;
  offset: { x: number; y: number };
}

/**
 * Brain button style configuration
 */
export interface BrainButtonStyle {
  backgroundColor: string;
  color: string;
  border: string;
  borderRadius: string;
  fontSize: string;
  padding: string;
  boxShadow: string;
  cursor: string;
}

/**
 * Interface for brain button service
 */
export interface IBrainButtonService {
  /**
   * Show brain button at specified position
   */
  show(position: { x: number; y: number }, onSave: () => void): void;

  /**
   * Hide brain button
   */
  hide(): void;

  /**
   * Update button position
   */
  updatePosition(position: { x: number; y: number }): void;

  /**
   * Update button style
   */
  setStyle(style: BrainButtonStyle): void;

  /**
   * Update button configuration
   */
  updateConfig(config: Partial<BrainButtonConfig>): void;

  /**
   * Check if button is visible
   */
  isVisible(): boolean;

  /**
   * Clean up button and event listeners
   */
  cleanup(): void;
}

/**
 * Default brain button configuration
 */
export const DEFAULT_BRAIN_BUTTON_CONFIG: BrainButtonConfig = {
  position: 'top-right',
  style: 'minimal',
  size: 'medium',
  animation: 'fade-in',
  zIndex: 999999,
  offset: { x: 10, y: 10 }
};

/**
 * Style configurations for different themes
 */
export const BRAIN_BUTTON_STYLES: Record<string, BrainButtonStyle> = {
  minimal: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    fontSize: '16px',
    padding: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    cursor: 'pointer'
  },
  fancy: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    fontSize: '18px',
    padding: '14px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
    cursor: 'pointer'
  },
  dark: {
    backgroundColor: '#2c3e50',
    color: 'white',
    border: '2px solid #34495e',
    borderRadius: '50%',
    fontSize: '16px',
    padding: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    cursor: 'pointer'
  },
  light: {
    backgroundColor: 'white',
    color: '#007bff',
    border: '2px solid #007bff',
    borderRadius: '50%',
    fontSize: '16px',
    padding: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    cursor: 'pointer'
  }
};

/**
 * Size configurations
 */
export const BRAIN_BUTTON_SIZES = {
  small: { width: '32px', height: '32px', fontSize: '14px' },
  medium: { width: '40px', height: '40px', fontSize: '16px' },
  large: { width: '48px', height: '48px', fontSize: '18px' }
};

/**
 * Modular brain button service
 * Completely swappable and configurable
 */
export class BrainButtonService implements IBrainButtonService {
  private button: HTMLButtonElement | null = null;
  private config: BrainButtonConfig;
  private style: BrainButtonStyle;
  private accessibilityService: IAccessibilityService;
  private onSaveCallback: (() => void) | null = null;
  private _isVisible = false;

  constructor(
    config: BrainButtonConfig = DEFAULT_BRAIN_BUTTON_CONFIG,
    accessibilityService?: IAccessibilityService
  ) {
    this.config = { ...config };
    this.style = { ...BRAIN_BUTTON_STYLES[config.style] };
    this.accessibilityService = accessibilityService || ({} as IAccessibilityService);
  }

  show(position: { x: number; y: number }, onSave: () => void): void {
    this.hide(); // Remove existing button if any
    this.onSaveCallback = onSave;

    this.button = this.createButton();
    this.positionButton(position);
    this.addEventListeners();
    this.addToDOM();
    this.applyAnimation();

    this._isVisible = true;

    // Announce to screen readers
    if (this.accessibilityService.announceToScreenReader) {
      this.accessibilityService.announceToScreenReader({
        message: 'Brain button appeared. Click to save selected text as context.',
        priority: 'polite'
      });
    }
  }

  hide(): void {
    if (this.button && this.button.parentElement) {
      this.removeEventListeners();
      this.button.parentElement.removeChild(this.button);
    }
    this.button = null;
    this.onSaveCallback = null;
    this._isVisible = false;
  }

  updatePosition(position: { x: number; y: number }): void {
    if (this.button) {
      this.positionButton(position);
    }
  }

  setStyle(style: BrainButtonStyle): void {
    this.style = { ...style };
    if (this.button) {
      this.applyStyle();
    }
  }

  updateConfig(config: Partial<BrainButtonConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.button) {
      this.applyStyle();
      this.applySize();
    }
  }

  isVisible(): boolean {
    return this._isVisible;
  }

  cleanup(): void {
    this.hide();
  }

  private createButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = 'spine-brain-button';
    button.innerHTML = '🧠';
    button.setAttribute('aria-label', 'Save selected text as context');
    button.setAttribute('title', 'Save selected text as context');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');

    this.applyStyle();
    this.applySize();

    return button;
  }

  private positionButton(position: { x: number; y: number }): void {
    if (!this.button) return;

    const { x, y } = position;
    const { offset } = this.config;

    let finalX = x + offset.x;
    let finalY = y + offset.y;

    // Adjust position based on config
    switch (this.config.position) {
      case 'top-right':
        // Position is already top-right
        break;
      case 'top-left':
        finalX = x - offset.x;
        break;
      case 'bottom-right':
        finalY = y + offset.y;
        break;
      case 'bottom-left':
        finalX = x - offset.x;
        finalY = y + offset.y;
        break;
      case 'center':
        finalX = x;
        finalY = y;
        break;
    }

    // Ensure button stays within viewport
    const buttonRect = this.button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (finalX + buttonRect.width > viewportWidth) {
      finalX = viewportWidth - buttonRect.width - 10;
    }
    if (finalY + buttonRect.height > viewportHeight) {
      finalY = viewportHeight - buttonRect.height - 10;
    }
    if (finalX < 10) finalX = 10;
    if (finalY < 10) finalY = 10;

    this.button.style.position = 'absolute';
    this.button.style.left = `${finalX}px`;
    this.button.style.top = `${finalY}px`;
    this.button.style.zIndex = this.config.zIndex.toString();
  }

  private addEventListeners(): void {
    if (!this.button) return;

    this.button.addEventListener('click', this.handleClick.bind(this));
    this.button.addEventListener('keydown', this.handleKeydown.bind(this));
    this.button.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
    this.button.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
  }

  private removeEventListeners(): void {
    if (!this.button) return;

    this.button.removeEventListener('click', this.handleClick.bind(this));
    this.button.removeEventListener('keydown', this.handleKeydown.bind(this));
    this.button.removeEventListener('mouseenter', this.handleMouseEnter.bind(this));
    this.button.removeEventListener('mouseleave', this.handleMouseLeave.bind(this));
  }

  private addToDOM(): void {
    if (this.button) {
      document.body.appendChild(this.button);
    }
  }

  private applyStyle(): void {
    if (!this.button) return;

    Object.assign(this.button.style, {
      backgroundColor: this.style.backgroundColor,
      color: this.style.color,
      border: this.style.border,
      borderRadius: this.style.borderRadius,
      fontSize: this.style.fontSize,
      padding: this.style.padding,
      boxShadow: this.style.boxShadow,
      cursor: this.style.cursor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      outline: 'none',
      transition: 'all 0.2s ease'
    });
  }

  private applySize(): void {
    if (!this.button) return;

    const sizeConfig = BRAIN_BUTTON_SIZES[this.config.size];
    Object.assign(this.button.style, {
      width: sizeConfig.width,
      height: sizeConfig.height,
      fontSize: sizeConfig.fontSize
    });
  }

  private applyAnimation(): void {
    if (!this.button) return;

    switch (this.config.animation) {
      case 'fade-in':
        this.button.style.opacity = '0';
        this.button.style.transform = 'scale(0.8)';
        requestAnimationFrame(() => {
          if (this.button) {
            this.button.style.opacity = '1';
            this.button.style.transform = 'scale(1)';
          }
        });
        break;
      case 'slide-in':
        this.button.style.opacity = '0';
        this.button.style.transform = 'translateY(-20px)';
        requestAnimationFrame(() => {
          if (this.button) {
            this.button.style.opacity = '1';
            this.button.style.transform = 'translateY(0)';
          }
        });
        break;
      case 'bounce':
        this.button.style.opacity = '0';
        this.button.style.transform = 'scale(0.3)';
        requestAnimationFrame(() => {
          if (this.button) {
            this.button.style.opacity = '1';
            this.button.style.transform = 'scale(1.1)';
            setTimeout(() => {
              if (this.button) {
                this.button.style.transform = 'scale(1)';
              }
            }, 150);
          }
        });
        break;
      case 'none':
        // No animation
        break;
    }
  }

  private handleClick(): void {
    if (this.onSaveCallback) {
      this.onSaveCallback();
    }
    this.hide();
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.handleClick();
    } else if (event.key === 'Escape') {
      this.hide();
    }
  }

  private handleMouseEnter(): void {
    if (this.button) {
      this.button.style.transform = 'scale(1.1)';
    }
  }

  private handleMouseLeave(): void {
    if (this.button) {
      this.button.style.transform = 'scale(1)';
    }
  }
}
