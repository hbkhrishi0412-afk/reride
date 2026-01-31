# Contributing to ReRide

Thank you for your interest in contributing to ReRide! This document provides guidelines and standards for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Security Guidelines](#security-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a positive environment

## Getting Started

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/reride.git
   cd reride
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**
   - Copy `env.example` to `.env.local`
   - Fill in required Supabase credentials
   - See `SETUP_SUPABASE_ENV.md` for detailed instructions

4. **Run Development Server**
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test additions/updates

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

Example:
```
feat(auth): add OAuth login support

Implement Google OAuth authentication flow with proper error handling
and token refresh mechanism.

Closes #123
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Avoid `any` - use proper types or `unknown`
- Use interfaces for object shapes
- Prefer type unions over enums where appropriate

### React

- Use functional components with hooks
- Keep components small and focused
- Use `React.memo` for expensive components
- Prefer composition over inheritance

### Code Style

- **Formatting**: Use Prettier (configured in `.prettierrc.json`)
- **Linting**: Use ESLint (configured in `.eslintrc.cjs`)
- **Imports**: Use absolute imports where possible
- **Naming**: 
  - Components: PascalCase (`UserProfile.tsx`)
  - Functions: camelCase (`getUserData`)
  - Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`)
  - Types/Interfaces: PascalCase (`UserData`)

### File Organization

```
components/
  ComponentName/
    ComponentName.tsx
    ComponentName.test.tsx
    index.ts
services/
  serviceName.ts
utils/
  utilityName.ts
types.ts
```

### Security Best Practices

1. **Never log secrets**: Use `sanitizeError()` from `utils/secretSanitizer.ts`
2. **Sanitize user input**: Use `sanitizeString()` and `sanitizeObject()` from `utils/security.ts`
3. **Validate on server**: Never trust client-side validation alone
4. **Use environment variables**: Never hardcode secrets
5. **Rate limiting**: Respect rate limits in API calls

### Performance

- Use lazy loading for large components
- Implement code splitting for routes
- Optimize images and assets
- Use React.memo for expensive renders
- Avoid unnecessary re-renders

## Testing

### Unit Tests

- Write tests for utilities and services
- Use Jest and React Testing Library
- Aim for >70% coverage

```bash
npm test
npm run test:coverage
```

### E2E Tests

- Write E2E tests for critical user flows
- Use Playwright
- Test: registration, posting, messaging

```bash
npm run test:e2e
```

### Accessibility Tests

- Run accessibility tests before PR
- Use axe-core for automated checks

```bash
npm run test:a11y
```

## Security Guidelines

### Before Committing

- ✅ No secrets in code or logs
- ✅ Input validation on all user inputs
- ✅ Proper error handling (no stack traces to users)
- ✅ Security headers configured
- ✅ Dependencies up to date (`npm audit`)

### Security Checklist

- [ ] No hardcoded secrets
- [ ] Input sanitization applied
- [ ] Error messages don't expose sensitive data
- [ ] Rate limiting implemented
- [ ] Authentication/authorization checks
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (input sanitization)
- [ ] CSRF protection

## Pull Request Process

1. **Update Documentation**
   - Update README if needed
   - Add/update JSDoc comments
   - Update CHANGELOG.md

2. **Run Tests**
   ```bash
   npm run lint
   npm run type-check
   npm test
   npm run test:e2e
   ```

3. **Create Pull Request**
   - Clear title and description
   - Reference related issues
   - Include screenshots for UI changes
   - Ensure CI passes

4. **Code Review**
   - Address review comments
   - Keep PR focused and small
   - Respond to feedback promptly

## Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [Playwright Documentation](https://playwright.dev/)

## Questions?

Feel free to open an issue or contact the maintainers.




