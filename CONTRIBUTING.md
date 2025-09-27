# Contributing to Winning Product

Thank you for your interest in contributing to Winning Product! This document provides guidelines and information for contributors.

## 🎯 Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Chrome browser for testing
- Git for version control

### Development Setup

1. **Fork and clone the repository**
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

4. **Load in Chrome for testing**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder

5. **Seed demo data for testing**
   ```bash
   npm run demo
   ```

## 🏗️ Architecture Overview

### Core Principles

Our architecture follows these fundamental principles:

1. **Interface-First Design** - Define contracts before implementation
2. **Dependency Inversion** - Depend on abstractions, not concretions
3. **Separation of Concerns** - Each module has a single responsibility
4. **Composition over Inheritance** - Build complex behavior from simple components
5. **SICP Thinking** - Deconstruct problems to fundamental truths

### Project Structure

```
core/
├── accessibility-service.ts  # Keyboard navigation & ARIA support
├── concurrency-service.ts    # Atomic operations & retry logic
├── storage-service.ts        # Chrome storage abstraction
├── ui-service.ts             # UI components & interactions
└── types.ts                  # Type definitions & contracts

tests/
├── concurrency.spec.ts       # Concurrency & atomic operations tests
├── storage.spec.ts          # Storage service tests
└── ui.spec.ts               # UI component tests
```

### Service Architecture

Each service follows a consistent pattern:

```typescript
// 1. Define interface contract
export interface IServiceName {
  methodName(): Promise<ReturnType>;
}

// 2. Implement with dependency injection
export class ServiceName implements IServiceName {
  constructor(private dependency: IDependency) {}
  
  async methodName(): Promise<ReturnType> {
    // Implementation with error handling
  }
}
```

## 🧪 Testing Guidelines

### Test Structure

All tests follow the Arrange-Act-Assert pattern:

```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should handle success case', async () => {
      // Arrange
      const service = new ServiceName(mockDependency);
      const input = 'test input';
      
      // Act
      const result = await service.methodName(input);
      
      // Assert
      expect(result).toBeDefined();
      expect(mockDependency.method).toHaveBeenCalledWith(input);
    });
    
    it('should handle error case', async () => {
      // Arrange
      const service = new ServiceName(failingDependency);
      
      // Act & Assert
      await expect(service.methodName()).rejects.toThrow('Expected error');
    });
  });
});
```

### Test Categories

1. **Unit Tests** - Test individual components in isolation
2. **Integration Tests** - Test component interactions
3. **Concurrency Tests** - Test race conditions and atomic operations
4. **Accessibility Tests** - Test keyboard navigation and ARIA compliance

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/concurrency.spec.ts

# Run tests with coverage
npm test -- --coverage

# Watch mode for development
npm test -- --watch
```

## 🔧 Development Workflow

### Feature Development

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Implement following TDD approach**
   - Write failing test first
   - Implement minimal code to pass
   - Refactor while keeping tests green

3. **Ensure all tests pass**
   ```bash
   npm test
   ```

4. **Build and test manually**
   ```bash
   npm run build
   # Test in Chrome browser
   ```

### Code Quality Standards

#### TypeScript Guidelines

- Use strict TypeScript configuration
- Define explicit types for all public APIs
- Use interfaces for contracts and types for data
- Prefer composition over inheritance

```typescript
// Good: Interface-first design
interface IStorageService {
  savePrompt(prompt: Prompt): Promise<void>;
  getPrompts(): Promise<Prompt[]>;
}

// Good: Explicit typing
const prompts: Prompt[] = await storage.getPrompts();

// Good: Error handling
try {
  await storage.savePrompt(prompt);
} catch (error) {
  console.error('Failed to save prompt:', error);
  throw new Error('Save operation failed');
}
```

#### Error Handling

- Always handle errors gracefully
- Provide meaningful error messages
- Use specific error types when possible
- Log errors for debugging

```typescript
// Good: Specific error handling
if (!prompt.name.trim()) {
  throw new ValidationError('Prompt name is required');
}

// Good: Graceful degradation
try {
  return await this.primaryService.getData();
} catch (error) {
  console.warn('Primary service failed, falling back to secondary');
  return await this.fallbackService.getData();
}
```

#### Accessibility Guidelines

- All UI components must be keyboard accessible
- Implement proper ARIA attributes
- Provide screen reader announcements
- Ensure proper focus management

```typescript
// Good: Accessibility-first implementation
button.setAttribute('aria-label', 'Save prompt');
button.setAttribute('role', 'button');
button.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    this.handleSave();
  }
});
```

### Commit Guidelines

We follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**
```bash
git commit -m "feat(ui): add keyboard navigation to prompt selector"
git commit -m "fix(storage): resolve race condition in concurrent saves"
git commit -m "test(concurrency): add stress tests for atomic operations"
```

## 🚀 Pull Request Process

### Before Submitting

1. **Run the full test suite**
   ```bash
   npm test
   ```

2. **Build and test manually**
   ```bash
   npm run build
   # Test all functionality in Chrome
   ```

3. **Check code quality**
   - Ensure TypeScript compiles without errors
   - Verify all public APIs are documented
   - Check for accessibility compliance

4. **Update documentation**
   - Update README if needed
   - Add inline documentation for complex code
   - Update type definitions if APIs changed

### PR Description Template

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Accessibility testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated Checks**
   - CI pipeline runs all tests
   - Build validation
   - Code quality checks

2. **Manual Review**
   - Code quality and architecture
   - Test coverage and quality
   - Documentation completeness
   - Accessibility compliance

3. **Approval Requirements**
   - All tests must pass
   - At least one maintainer approval
   - No unresolved discussions

## 🐛 Bug Reports

### Before Reporting

1. Check existing issues
2. Test with latest version
3. Try to reproduce consistently
4. Check browser console for errors

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Type '....'
4. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- OS: [e.g., Windows 10]
- Chrome Version: [e.g., 120.0.6099.71]
- Extension Version: [e.g., 1.0.0]

## Additional Context
Screenshots, console logs, etc.
```

## 💡 Feature Requests

### Feature Request Template

```markdown
## Feature Description
Clear description of the proposed feature.

## Motivation
Why is this feature needed?

## Proposed Solution
How should this feature work?

## Alternatives Considered
Other approaches you've considered.

## Additional Context
Screenshots, mockups, etc.
```

## 📚 Resources

### Documentation
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Tools
- [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools)
- [Vitest Documentation](https://vitest.dev/)
- [ESBuild Documentation](https://esbuild.github.io/)

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Focus on the code, not the person

### Communication

- Use clear, descriptive language
- Provide context for discussions
- Be patient with questions
- Share knowledge and resources

## 📞 Getting Help

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and ideas
- **Pull Request Comments** - Code-specific discussions

## 🙏 Recognition

Contributors will be recognized in:
- README contributors section
- Release notes
- GitHub contributor graphs

Thank you for contributing to Winning Product! 🚀
