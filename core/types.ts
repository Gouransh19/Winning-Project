// core/types.ts
// Machine-checkable core data models for The Spine Forge (TypeScript Edition)
export interface Prompt {
  id: string;
  name: string;
  template: string;
  description: string;
}

export interface Context {
  id: string;
  name: string;
  text: string;
}

// Message contracts for the background/message router
export type Message =
  | { type: 'GET_PROMPTS_REQUEST' }
  | { type: 'GET_PROMPTS_RESPONSE'; payload: Prompt[] };

