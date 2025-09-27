#!/usr/bin/env node

/**
 * Demo reset script for Winning Product Chrome Extension
 * 
 * This script clears all demo data from chrome.storage.local
 * 
 * Usage:
 *   npm run demo:reset
 *   node scripts/reset-demo.js
 * 
 * Or run directly in Chrome Extension Service Worker console:
 *   copy-paste the resetDemoData() function call
 */

/**
 * Reset demo data (clear all storage)
 */
function resetDemoData() {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      reject(new Error('Chrome extension APIs not available. Run this script in the Chrome Extension Service Worker console.'));
      return;
    }

    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to clear storage: ${chrome.runtime.lastError.message}`));
        return;
      }

      console.log('🗑️ Demo data cleared successfully!');
      console.log('🔄 Extension storage has been reset to initial state');
      resolve();
    });
  });
}

// Export function for use in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    resetDemoData
  };
}

// Auto-run if this script is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  console.log('🗑️ Demo reset script for Winning Product Chrome Extension');
  console.log('📋 This script is designed to run in the Chrome Extension Service Worker console.');
  console.log('🔧 To use this script:');
  console.log('   1. Open Chrome Developer Tools');
  console.log('   2. Go to Extensions tab');
  console.log('   3. Click "Service Worker" for Winning Product extension');
  console.log('   4. Copy and paste the resetDemoData() function call');
  console.log('');
  console.log('⚠️ This will clear ALL extension data!');
  console.log('🚀 Ready to reset demo data!');
}
