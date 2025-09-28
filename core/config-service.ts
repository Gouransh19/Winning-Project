// core/config-service.ts
// Configuration service for modular component management

import { SelectionConfig, DEFAULT_SELECTION_CONFIG } from './selection-service';
import { BrainButtonConfig, DEFAULT_BRAIN_BUTTON_CONFIG } from './brain-button-service';

/**
 * Main configuration interface
 */
export interface ExtensionConfig {
  selection: SelectionConfig;
  brainButton: BrainButtonConfig;
  context: ContextConfig;
  ui: UIConfig;
}

/**
 * Context-specific configuration
 */
export interface ContextConfig {
  maxContexts: number;
  maxContextLength: number;
  autoSave: boolean;
  defaultContextName: string;
}

/**
 * UI-specific configuration
 */
export interface UIConfig {
  theme: 'light' | 'dark' | 'auto';
  animations: boolean;
  soundEffects: boolean;
  showTooltips: boolean;
}

/**
 * Default context configuration
 */
export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  maxContexts: 100,
  maxContextLength: 10000,
  autoSave: false,
  defaultContextName: 'Untitled Context'
};

/**
 * Default UI configuration
 */
export const DEFAULT_UI_CONFIG: UIConfig = {
  theme: 'auto',
  animations: true,
  soundEffects: false,
  showTooltips: true
};

/**
 * Default extension configuration
 */
export const DEFAULT_EXTENSION_CONFIG: ExtensionConfig = {
  selection: DEFAULT_SELECTION_CONFIG,
  brainButton: DEFAULT_BRAIN_BUTTON_CONFIG,
  context: DEFAULT_CONTEXT_CONFIG,
  ui: DEFAULT_UI_CONFIG
};

/**
 * Interface for configuration service
 */
export interface IConfigService {
  /**
   * Get the complete configuration
   */
  getConfig(): ExtensionConfig;

  /**
   * Get selection configuration
   */
  getSelectionConfig(): SelectionConfig;

  /**
   * Get brain button configuration
   */
  getBrainButtonConfig(): BrainButtonConfig;

  /**
   * Get context configuration
   */
  getContextConfig(): ContextConfig;

  /**
   * Get UI configuration
   */
  getUIConfig(): UIConfig;

  /**
   * Update a specific configuration section
   */
  updateConfig<K extends keyof ExtensionConfig>(
    section: K,
    config: Partial<ExtensionConfig[K]>
  ): void;

  /**
   * Update a specific configuration value
   */
  updateValue<K extends keyof ExtensionConfig, T extends keyof ExtensionConfig[K]>(
    section: K,
    key: T,
    value: ExtensionConfig[K][T]
  ): void;

  /**
   * Reset configuration to defaults
   */
  resetConfig(): void;

  /**
   * Save configuration to storage
   */
  saveConfig(): Promise<void>;

  /**
   * Load configuration from storage
   */
  loadConfig(): Promise<void>;
}

/**
 * Configuration service implementation
 * Manages all extension configuration in a modular way
 */
export class ConfigService implements IConfigService {
  private config: ExtensionConfig;
  private storageKey = 'extension_config';

  constructor(initialConfig?: Partial<ExtensionConfig>) {
    this.config = { ...DEFAULT_EXTENSION_CONFIG };
    if (initialConfig) {
      this.mergeConfig(initialConfig);
    }
  }

  getConfig(): ExtensionConfig {
    return { ...this.config };
  }

  getSelectionConfig(): SelectionConfig {
    return { ...this.config.selection };
  }

  getBrainButtonConfig(): BrainButtonConfig {
    return { ...this.config.brainButton };
  }

  getContextConfig(): ContextConfig {
    return { ...this.config.context };
  }

  getUIConfig(): UIConfig {
    return { ...this.config.ui };
  }

  updateConfig<K extends keyof ExtensionConfig>(
    section: K,
    config: Partial<ExtensionConfig[K]>
  ): void {
    this.config[section] = { ...this.config[section], ...config };
  }

  updateValue<K extends keyof ExtensionConfig, T extends keyof ExtensionConfig[K]>(
    section: K,
    key: T,
    value: ExtensionConfig[K][T]
  ): void {
    (this.config[section] as any)[key] = value;
  }

  resetConfig(): void {
    this.config = { ...DEFAULT_EXTENSION_CONFIG };
  }

  async saveConfig(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise<void>((resolve, reject) => {
          chrome.storage.local.set({ [this.storageKey]: this.config }, () => {
            if (chrome.runtime?.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.warn('ConfigService: Failed to save config:', error);
    }
  }

  async loadConfig(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise<void>((resolve, reject) => {
          chrome.storage.local.get([this.storageKey], (result) => {
            if (chrome.runtime?.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              const savedConfig = result[this.storageKey];
              if (savedConfig) {
                this.config = this.mergeConfig(savedConfig);
              }
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.warn('ConfigService: Failed to load config:', error);
    }
  }

  private mergeConfig(newConfig: Partial<ExtensionConfig>): ExtensionConfig {
    return {
      selection: { ...this.config.selection, ...newConfig.selection },
      brainButton: { ...this.config.brainButton, ...newConfig.brainButton },
      context: { ...this.config.context, ...newConfig.context },
      ui: { ...this.config.ui, ...newConfig.ui }
    };
  }
}
