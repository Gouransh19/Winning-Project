# Winning Product - Chrome Extension

> **Professional Chrome Extension for AI Chat Interfaces**  
> *Enhance your productivity with intelligent prompt management and context saving*

[![CI](https://github.com/your-username/winning-product/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/winning-product/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

## 🚀 Features

### Core Commands
- **`//`** - Intelligent prompt enhancement with AI
- **`@`** - Context saving and management  
- **`+`** - Save custom prompts to your library

### Key Capabilities
- **Keyboard-First Design** - Complete accessibility with ARIA support
- **Atomic Operations** - Concurrency-safe storage with retry logic
- **Cross-Platform** - Works on ChatGPT, Claude, Gemini, and more
- **Professional UX** - Minimalist, dark theme with smooth animations

## 🎯 Quick Start

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/winning-product.git
   cd winning-product
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder

### Demo Setup

Get started instantly with demo data:

```bash
# Seed demo data (run in Chrome Extension Service Worker console)
npm run demo

# Reset demo data
npm run demo:reset
```

**Manual Demo Setup:**
1. Open Chrome Developer Tools
2. Go to Extensions tab
3. Click "Service Worker" for Winning Product extension
4. Copy and paste: `seedDemoData()`
5. Press Enter to seed 8 sample prompts and 3 contexts

## 🛠️ Development

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Chrome browser

### Development Workflow

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run watch

# Run tests
npm test

# Clean build artifacts
npm run clean

# Full development setup
npm run dev
```

### Project Structure

```
winning-product/
├── core/                    # Core services and interfaces
│   ├── accessibility-service.ts  # Keyboard navigation & ARIA
│   ├── concurrency-service.ts    # Atomic operations & retry logic
│   ├── storage-service.ts        # Chrome storage abstraction
│   ├── ui-service.ts             # UI components & interactions
│   └── types.ts                  # Type definitions
├── scripts/                 # Utility scripts
│   ├── seed-demo.js         # Demo data seeding
│   └── reset-demo.js        # Demo data reset
├── tests/                   # Test suites
│   ├── concurrency.spec.ts  # Concurrency & atomic operations
│   ├── storage.spec.ts      # Storage service tests
│   └── ui.spec.ts          # UI component tests
├── dist/                    # Built extension (auto-generated)
├── background.ts           # Extension background script
├── content.ts              # Content script
└── manifest.json           # Extension manifest
```

### Architecture Principles

- **Interface-First Design** - Contracts defined before implementation
- **Dependency Inversion** - Loose coupling through interfaces
- **Atomic Operations** - Concurrency-safe with retry logic
- **Accessibility-First** - WCAG compliant with keyboard navigation
- **Test-Driven** - Comprehensive test coverage for reliability

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test tests/concurrency.spec.ts

# Watch mode for development
npm test -- --watch
```

### Test Coverage

- **Unit Tests** - Individual component testing
- **Integration Tests** - Service interaction testing  
- **Concurrency Tests** - Race condition and atomic operation testing
- **Accessibility Tests** - Keyboard navigation and ARIA compliance

## 🚀 Usage

### Basic Commands

1. **Enhance Prompts** (`//`)
   - Type `//` followed by your prompt
   - Get AI-enhanced version with improved clarity and structure

2. **Save Context** (`@`)
   - Highlight any text on the page
   - Click the brain button to save as context
   - Access saved contexts with `@` command

3. **Save Prompts** (`+`)
   - Type `+` to open the save prompt modal
   - Enter name, description, and template
   - Use saved prompts with `//` command

### Keyboard Navigation

- **Tab** - Navigate between elements
- **Arrow Keys** - Navigate list items
- **Enter/Space** - Activate focused element
- **Escape** - Close modals and return focus
- **Home/End** - Jump to first/last item

### Accessibility Features

- **Screen Reader Support** - Full ARIA compliance
- **Keyboard Navigation** - Complete keyboard-only operation
- **Focus Management** - Proper focus restoration
- **Live Regions** - Real-time announcements
- **High Contrast** - Support for accessibility themes

## 🔧 Configuration

### Accessibility Settings

The extension supports configurable accessibility features:

```typescript
interface AccessibilityConfig {
  enableKeyboardNavigation: boolean;
  enableScreenReader: boolean;
  enableFocusManagement: boolean;
  announceActions: boolean;
  highContrastMode: boolean;
}
```

### Concurrency Settings

Atomic operations with configurable retry logic:

```typescript
interface ConcurrencyConfig {
  maxRetries: number;
  retryDelay: number;
  enableMetrics: boolean;
  logOperations: boolean;
}
```

## 🐛 Troubleshooting

### Common Issues

**Extension not loading:**
- Ensure you're loading the `dist/` folder, not the root directory
- Check that `npm run build` completed successfully
- Verify Chrome Developer mode is enabled

**Commands not working:**
- Ensure you're on a supported AI chat platform
- Check browser console for errors
- Verify the extension is active and has proper permissions

**Demo data not seeding:**
- Run the seeding script in the Service Worker console, not the page console
- Check that Chrome storage APIs are available
- Verify the extension is properly loaded

### Debug Mode

Enable debug logging:

1. Open Chrome Developer Tools
2. Go to Extensions tab
3. Click "Service Worker" for the extension
4. Set breakpoints in the code
5. Use `console.log` statements for debugging

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following the coding standards
4. Add tests for new functionality
5. Run the test suite: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Coding Standards

- **TypeScript** - Use TypeScript for all new code
- **Interface-First** - Define contracts before implementation
- **Test Coverage** - Maintain high test coverage
- **Accessibility** - Ensure WCAG compliance
- **Documentation** - Document public APIs and complex logic

### Pull Request Process

1. Ensure all tests pass
2. Update documentation for new features
3. Add appropriate test coverage
4. Follow the conventional commit format
5. Request review from maintainers

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies and accessibility best practices
- Inspired by the need for better AI chat productivity tools
- Designed with first principles and systems thinking approach

## 📞 Support

- **Issues** - [GitHub Issues](https://github.com/your-username/winning-product/issues)
- **Discussions** - [GitHub Discussions](https://github.com/your-username/winning-product/discussions)
- **Documentation** - This README and inline code documentation

---

**Made with ❤️ for the AI productivity community**
