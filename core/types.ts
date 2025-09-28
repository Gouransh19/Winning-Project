// core/types.ts
// Machine-checkable core data models for The Spine Forge (TypeScript Edition)
export interface Prompt {
  id: string;
  name: string;
  template: string;
  description: string;
  // Optional timestamps managed by storage
  createdAt?: number;
  updatedAt?: number;
}

export interface Context {
  id: string;
  name: string;
  text: string;
  // Optional timestamps managed by storage
  createdAt?: number;
  updatedAt?: number;
}

// Message contracts for the background/message router
import { SavePromptUIResult, SaveContextUIResult } from './ui-service';
import { ConcurrencyMetrics } from './concurrency-service';

export type Message =
  | { type: 'GET_PROMPTS_REQUEST' }
  | { type: 'GET_PROMPTS_RESPONSE'; payload: Prompt[] }
  // Request to save a new prompt, initiated by the UI.
  | { type: 'SAVE_PROMPT_REQUEST'; payload: SavePromptUIResult }
  // Response to a save request, indicating success or failure.
  | { type: 'SAVE_PROMPT_RESPONSE'; payload: { success: boolean; error?: string } }
  // Request for concurrency metrics
  | { type: 'GET_CONCURRENCY_METRICS_REQUEST' }
  // Response with concurrency metrics
  | { type: 'GET_CONCURRENCY_METRICS_RESPONSE'; payload: ConcurrencyMetrics | null }
  // Context management messages
  | { type: 'GET_CONTEXTS_REQUEST' }
  | { type: 'GET_CONTEXTS_RESPONSE'; payload: Context[] }
  | { type: 'SAVE_CONTEXT_REQUEST'; payload: SaveContextUIResult }
  | { type: 'SAVE_CONTEXT_RESPONSE'; payload: { success: boolean; error?: string } }
  | { type: 'DELETE_CONTEXT_REQUEST'; payload: { id: string } }
  | { type: 'DELETE_CONTEXT_RESPONSE'; payload: { success: boolean; error?: string } };

