// content.ts
// Content script: orchestrates the UI and storage services.
import { Message, Prompt, Context } from './core/types';
import { IUIService, UIService } from './core/ui-service';
import { ISelectionService, SelectionService } from './core/selection-service';
import { IConfigService, ConfigService } from './core/config-service';

declare const chrome: any;

// Services are now responsible for implementation details.
const configService: IConfigService = new ConfigService();
const selectionService: ISelectionService = new SelectionService();
const ui: IUIService = new UIService();

// Initialize text selection detection
selectionService.onSelectionChange((hasSelection, selectedText) => {
  if (hasSelection) {
    console.log("CONTENT: Text selected, showing brain button");
    const bounds = selectionService.getSelectionBounds();
    if (bounds) {
      ui.showBrainButton({ x: bounds.x, y: bounds.y }, () => {
        console.log("CONTENT: Brain button clicked, opening save context modal");
        ui.showSaveContextModal(selectedText).then((result) => {
          if (result) {
            console.log("CONTENT: User wants to save context:", result);
            
            // Send save request to background
            chrome.runtime.sendMessage({ 
              type: 'SAVE_CONTEXT_REQUEST', 
              payload: result 
            } as Message, (response: Message) => {
              console.log('CONTENT: Save context response:', response);
              
              if (response?.type === 'SAVE_CONTEXT_RESPONSE') {
                const saveResponse = response as any;
                if (saveResponse.payload?.success) {
                  ui.showSuccessToast('Context saved successfully!');
                } else {
                  console.error('CONTENT: Failed to save context:', saveResponse.payload?.error);
                  ui.showSuccessToast('Failed to save context: ' + (saveResponse.payload?.error || 'Unknown error'));
                }
              }
            });
          } else {
            console.log("CONTENT: User cancelled save context modal.");
          }
        });
      });
    }
  } else {
    console.log("CONTENT: No text selected, hiding brain button");
    ui.hideBrainButton();
  }
});

// Main application logic
ui.onTextAreaInput(text => {
  if (text.endsWith('//')) {
    console.log("CONTENT: Detected '//', requesting prompts.");

    // Message the background script to get prompts from storage.
    // In a future step, we could have the content script use the StorageService directly,
    // but this keeps the security boundary clear for now.
    chrome.runtime.sendMessage({ type: 'GET_PROMPTS_REQUEST' } as Message, (response: Message) => {
      console.log('CONTENT: Received response:', response);
      if (response?.type !== 'GET_PROMPTS_RESPONSE' || !('payload' in response)) {
        return;
      }

      const prompts: Prompt[] = (response as any).payload || [];

      // Use the UI service to show the selector
      ui.showPromptSelector(prompts, (selectedPrompt) => {
        // On select, use the UI service to update the text area
        const currentText = ui.getTextAreaValue();
        const newText = currentText.replace(/\/\/$/, selectedPrompt.template);
        ui.setTextAreaValue(newText);
      });
    });
  } else if (text.endsWith('@')) {
    console.log("CONTENT: Detected '@', requesting contexts.");

    // Message the background script to get contexts from storage
    chrome.runtime.sendMessage({ type: 'GET_CONTEXTS_REQUEST' } as Message, (response: Message) => {
      console.log('CONTENT: Received contexts response:', response);
      if (response?.type !== 'GET_CONTEXTS_RESPONSE' || !('payload' in response)) {
        return;
      }

      const contexts: Context[] = (response as any).payload || [];

      // Use the UI service to show the context selector
      ui.showContextSelector(contexts, (selectedContext) => {
        // On select, use the UI service to update the text area
        const currentText = ui.getTextAreaValue();
        const newText = currentText.replace(/@$/, selectedContext.text);
        ui.setTextAreaValue(newText);
      });
    });
  } else if (text.endsWith('+')) {
    console.log("CONTENT: Detected '+', opening save prompt modal.");
    
    // Get the current text without the '+' character
    const promptText = text.slice(0, -1).trim();
    
    if (!promptText) {
      console.log("CONTENT: No text to save, ignoring '+' command.");
      return;
    }

    // Show the save prompt modal
    ui.showSavePromptModal(promptText).then((result) => {
      if (result) {
        console.log("CONTENT: User wants to save prompt:", result);
        
        // Send save request to background
        chrome.runtime.sendMessage({ 
          type: 'SAVE_PROMPT_REQUEST', 
          payload: result 
        } as Message, (response: Message) => {
          console.log('CONTENT: Save response:', response);
          
          if (response?.type === 'SAVE_PROMPT_RESPONSE') {
            const saveResponse = response as any;
            if (saveResponse.payload?.success) {
              ui.showSuccessToast('Prompt saved successfully!');
              // Remove the '+' from the text area
              const currentText = ui.getTextAreaValue();
              const newText = currentText.replace(/\+$/, '');
              ui.setTextAreaValue(newText);
            } else {
              console.error('CONTENT: Failed to save prompt:', saveResponse.payload?.error);
              ui.showSuccessToast('Failed to save prompt: ' + (saveResponse.payload?.error || 'Unknown error'));
            }
          }
        });
      } else {
        console.log("CONTENT: User cancelled save prompt modal.");
        // Remove the '+' from the text area
        const currentText = ui.getTextAreaValue();
        const newText = currentText.replace(/\+$/, '');
        ui.setTextAreaValue(newText);
      }
    });
  } else {
    // If text doesn't end with '//', '@', or '+', ensure the selectors are hidden.
    // The UI service is smart enough to handle this internally, but this is an explicit trigger.
    ui.hidePromptSelector();
    ui.hideContextSelector();
  }
});
