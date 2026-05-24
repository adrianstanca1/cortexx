# Contributing to CortexBuild Ultimate

**Version:** 3.0.0 | **Platform Health:** 100/100

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Git
- Docker (for local database)
- PM2 (for backend process management)

### Setup

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/cortexbuild-ultimate.git
cd cortexbuild-ultimate

# 2. Add upstream
git remote add upstream https://github.com/adrianstanca1/cortexbuild-ultimate.git

# 3. Install dependencies
npm install
cd server && npm install && cd ..

# 4. Configure environment
cp .env.example .env.local
# Edit .env.local with your settings

# 5. Start database
docker compose up -d  # or use local Postgres

# 6. Reset database
cd server && npm run db:reset:local

# 7. Start development
pm2 start server/index.js --name cortexbuild-api
npm run dev
```

---

## Branch Strategy

```
main              # Production-ready code
├── feature/*     # New features
├── fix/*         # Bug fixes
├── docs/*        # Documentation
├── perf/*        # Performance
└── test/*        # Tests
```

### Creating Branches

```bash
git checkout -b feature/add-calendar
git checkout -b fix/notification-error
git checkout -b docs/api-reference
```

---

## Commit Convention

Format: `type(scope): description`

| Type       | Use Case                              |
| ---------- | ------------------------------------- |
| `feat`     | New feature                           |
| `fix`      | Bug fix                               |
| `docs`     | Documentation                         |
| `refactor` | Code restructure (no behavior change) |
| `perf`     | Performance improvement               |
| `test`     | Tests                                 |
| `chore`    | Maintenance                           |

### Examples

```
feat(modules): add project calendar module
fix(auth): resolve session timeout issue
docs(api): update endpoint documentation
perf(database): optimize slow queries
test(components): add unit tests for NotificationCenter
```

---

## Development Commands

### Frontend

```bash
npm run dev              # Dev server :5173 (proxies /api → :3001)
npm run build            # Production build → dist/
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm test                 # Vitest (happy-dom)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npx vitest run src/test/hooks.test.ts  # Single file
```

### Backend

```bash
cd server
npm run dev              # nodemon on :3001
npm start                # Production (node, not Docker)
npm run db:reset:local   # Rebuild local DB
```

### Verification

```bash
npm run verify:all       # Full pre-commit check
npm run verify:routes    # Verify 48 routes registered
```

---

## Making Changes

### 1. Create Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

```bash
# Edit files
git add src/components/modules/YourModule.tsx
git add server/routes/your-route.js
```

### 3. Test

```bash
# Run tests
npm test

# Run lint
npm run lint

# Build check
npm run build
```

### 4. Commit

```bash
git commit -m "feat(scope): description

- Bullet points for details
- Closes #123"
```

### 5. Push & PR

```bash
git push origin feature/your-feature-name
# Create PR on GitHub
```

---

## Pull Request Checklist

- [ ] Code follows style guidelines (ESLint passes)
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Build passes
- [ ] All tests pass
- [ ] Commit follows convention

### PR Template

```markdown
## Description

Brief description of changes

## Type

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing

- [ ] Tests pass locally
- [ ] New tests added
- [ ] Manual testing completed

## Checklist

- [ ] Code follows guidelines
- [ ] Documentation updated
- [ ] No breaking changes
```

---

## Code Standards

### TypeScript

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): Promise<User> {
  return api.get(`/users/${id}`);
}

// ❌ Bad
function getUser(id: any): any {
  return api.get(`/users/${id}`);
}
```

### React Components

```typescript
// ✅ Good
interface Props {
  user: User;
  onEdit?: () => void;
}

export function UserCard({ user, onEdit }: Props) {
  return <div>{user.name}</div>;
}

// ❌ Bad - no types, no interface
export function UserCard({ user }) {
  return <div>{user.name}</div>;
}
```

### CSS/Tailwind

```typescript
// ✅ Good
<div className="flex items-center gap-4 p-4 bg-base-100">

// ❌ Bad - inline styles
<div style={{ display: 'flex', padding: '16px' }}>
```

---

## Testing

### File Naming

```
src/components/ui/Button.test.tsx
src/hooks/useAuth.test.ts
src/lib/validation.test.ts
e2e/login.spec.ts
```

### Writing Tests

```typescript
describe("NotificationCenter", () => {
  it("renders notification list", () => {
    // Test implementation
  });

  it("marks notification as read when clicked", async () => {
    // Test implementation
  });
});
```

### Running Tests

```bash
npm test                  # All tests
npm run test:coverage     # With coverage
npm run test:watch       # Watch mode
npm test -- src/lib/validation.test.ts  # Single file
npm run test:e2e         # Playwright E2E
```

---

## Documentation

When adding features:

1. Update `README.md` - Quick summary
2. Update `docs/NEW_FEATURES_GUIDE.md` - Detailed guide
3. Update `CHANGELOG.md` - Version history
4. Add JSDoc comments to code

### JSDoc Template

```typescript
/**
 * Validates notification data against schema
 * @param data - Raw notification data
 * @returns Validated notification object
 * @throws {ZodError} If validation fails
 */
export function validateNotification(data: unknown): Notification {
  return NotificationSchema.parse(data);
}
```

---

## Common Issues

| Problem                        | Solution                                          |
| ------------------------------ | ------------------------------------------------- |
| `ECONNREFUSED` on auth         | Inside Docker: `DB_HOST` must be `cortexbuild-db` |
| `organization_id = NULL` crash | Use `COALESCE(organization_id, company_id)`       |
| `db.js` returns undefined      | `const pool = require('./db')` not destructured   |
| Route ordering                 | Register specific paths before wildcards          |

---

## Resources

- [Documentation Index](docs/README.md)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Deployment Runbook](DEPLOYMENT_RUNBOOK.md)
- [GitHub Issues](https://github.com/adrianstanca1/cortexbuild-ultimate/issues)
