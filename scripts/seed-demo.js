#!/usr/bin/env node

/**
 * Demo seeding script for Winning Product Chrome Extension
 * 
 * This script seeds the chrome.storage.local with demo prompts
 * to showcase the extension's functionality.
 * 
 * Usage:
 *   npm run demo
 *   node scripts/seed-demo.js
 * 
 * Or run directly in Chrome Extension Service Worker console:
 *   copy-paste the contents of this file
 */

// Demo prompts data
const demoPrompts = {
  'p1': {
    id: 'p1',
    name: 'first-principles',
    template: 'Apply first principles thinking to {{topic}}. Break down the problem into its fundamental components and rebuild the solution from the ground up.',
    description: 'Deconstruct complex problems using first principles reasoning.',
    createdAt: Date.now() - 86400000, // 1 day ago
    updatedAt: Date.now() - 86400000
  },
  'p2': {
    id: 'p2',
    name: 'systems-thinking',
    template: 'Analyze {{system}} using systems thinking. Map out the interconnected components, identify feedback loops, and consider the broader context.',
    description: 'Apply systems thinking methodology to understand complex systems.',
    createdAt: Date.now() - 172800000, // 2 days ago
    updatedAt: Date.now() - 172800000
  },
  'p3': {
    id: 'p3',
    name: 'code-review',
    template: 'Review this code for {{aspect}}: {{code}}\n\nConsider:\n- Code quality and maintainability\n- Performance implications\n- Security concerns\n- Best practices adherence\n- Testability',
    description: 'Comprehensive code review template with key focus areas.',
    createdAt: Date.now() - 259200000, // 3 days ago
    updatedAt: Date.now() - 259200000
  },
  'p4': {
    id: 'p4',
    name: 'architecture-design',
    template: 'Design a scalable architecture for {{application}} with the following requirements: {{requirements}}\n\nConsider:\n- Scalability patterns\n- Data consistency\n- Fault tolerance\n- Performance optimization\n- Security considerations',
    description: 'Template for designing scalable system architectures.',
    createdAt: Date.now() - 345600000, // 4 days ago
    updatedAt: Date.now() - 345600000
  },
  'p5': {
    id: 'p5',
    name: 'problem-solving',
    template: 'Solve this problem step by step: {{problem}}\n\nApproach:\n1. Define the problem clearly\n2. Identify constraints and assumptions\n3. Explore multiple solution approaches\n4. Evaluate trade-offs\n5. Implement the best solution',
    description: 'Structured approach to problem-solving with clear methodology.',
    createdAt: Date.now() - 432000000, // 5 days ago
    updatedAt: Date.now() - 432000000
  },
  'p6': {
    id: 'p6',
    name: 'technical-writing',
    template: 'Write clear technical documentation for {{topic}}:\n\nInclude:\n- Overview and purpose\n- Prerequisites\n- Step-by-step instructions\n- Code examples\n- Troubleshooting section\n- Related resources',
    description: 'Template for creating comprehensive technical documentation.',
    createdAt: Date.now() - 518400000, // 6 days ago
    updatedAt: Date.now() - 518400000
  },
  'p7': {
    id: 'p7',
    name: 'performance-analysis',
    template: 'Analyze the performance of {{system}} and provide optimization recommendations:\n\nFocus areas:\n- Bottleneck identification\n- Resource utilization\n- Scalability limits\n- Optimization opportunities\n- Monitoring and alerting',
    description: 'Comprehensive performance analysis and optimization guide.',
    createdAt: Date.now() - 604800000, // 7 days ago
    updatedAt: Date.now() - 604800000
  },
  'p8': {
    id: 'p8',
    name: 'security-audit',
    template: 'Conduct a security audit for {{application}}:\n\nCheck for:\n- Authentication and authorization\n- Input validation\n- Data encryption\n- Secure communication\n- Vulnerability assessment\n- Compliance requirements',
    description: 'Security audit checklist and methodology.',
    createdAt: Date.now() - 691200000, // 8 days ago
    updatedAt: Date.now() - 691200000
  }
};

// Demo contexts data
const demoContexts = {
  'c1': {
    id: 'c1',
    name: 'React Best Practices',
    text: 'Use functional components with hooks instead of class components. Implement proper state management with useState and useEffect. Follow the single responsibility principle for components. Use TypeScript for type safety. Implement proper error boundaries and loading states.',
    createdAt: Date.now() - 86400000
  },
  'c2': {
    id: 'c2',
    name: 'API Design Principles',
    text: 'Design RESTful APIs with clear resource naming. Use proper HTTP status codes. Implement pagination for large datasets. Include proper error handling and validation. Use versioning for backward compatibility. Document APIs comprehensively.',
    createdAt: Date.now() - 172800000
  },
  'c3': {
    id: 'c3',
    name: 'Database Optimization',
    text: 'Use proper indexing strategies. Normalize data appropriately. Implement connection pooling. Use query optimization techniques. Consider read replicas for scaling. Monitor query performance and slow queries.',
    createdAt: Date.now() - 259200000
  }
};

/**
 * Seed the chrome storage with demo data
 * This function can be called from the Chrome Extension Service Worker
 */
function seedDemoData() {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      reject(new Error('Chrome extension APIs not available. Run this script in the Chrome Extension Service Worker console.'));
      return;
    }

    // Clear existing data
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to clear storage: ${chrome.runtime.lastError.message}`));
        return;
      }

      // Set demo data
      chrome.storage.local.set({
        prompts: demoPrompts,
        contexts: demoContexts,
        _demoSeeded: true,
        _demoSeededAt: Date.now()
      }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to seed demo data: ${chrome.runtime.lastError.message}`));
          return;
        }

        console.log('🎉 Demo data seeded successfully!');
        console.log(`📝 ${Object.keys(demoPrompts).length} prompts added`);
        console.log(`📚 ${Object.keys(demoContexts).length} contexts added`);
        console.log('🚀 You can now test the extension with demo data');
        
        resolve({
          prompts: Object.keys(demoPrompts).length,
          contexts: Object.keys(demoContexts).length
        });
      });
    });
  });
}

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
      resolve();
    });
  });
}

/**
 * Check if demo data is seeded
 */
function isDemoSeeded() {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      reject(new Error('Chrome extension APIs not available. Run this script in the Chrome Extension Service Worker console.'));
      return;
    }

    chrome.storage.local.get(['_demoSeeded'], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Failed to check demo status: ${chrome.runtime.lastError.message}`));
        return;
      }

      resolve(!!result._demoSeeded);
    });
  });
}

// Export functions for use in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    seedDemoData,
    resetDemoData,
    isDemoSeeded,
    demoPrompts,
    demoContexts
  };
}

// Auto-run if this script is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  console.log('🌱 Demo seeding script for Winning Product Chrome Extension');
  console.log('📋 This script is designed to run in the Chrome Extension Service Worker console.');
  console.log('🔧 To use this script:');
  console.log('   1. Open Chrome Developer Tools');
  console.log('   2. Go to Extensions tab');
  console.log('   3. Click "Service Worker" for Winning Product extension');
  console.log('   4. Copy and paste the seedDemoData() function call');
  console.log('');
  console.log('📝 Demo data includes:');
  console.log(`   - ${Object.keys(demoPrompts).length} sample prompts`);
  console.log(`   - ${Object.keys(demoContexts).length} sample contexts`);
  console.log('');
  console.log('🚀 Ready to seed demo data!');
}
