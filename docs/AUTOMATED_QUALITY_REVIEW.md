# Automated quality review

Cortexx now performs a repository-wide application integrity audit on every pull request and every push to `main`.

The audit discovers App Router pages directly from the filesystem and validates static internal navigation targets against those routes, including dynamic route segments. It also rejects placeholder JavaScript links, unsafe `_blank` anchors without `noopener`, and duplicate page routes. Button semantics are inventoried and reported so missing explicit button types remain visible during review.

The check covers source files under `app`, `components`, and `lib`, complementing ESLint, TypeScript, unit tests, PostgreSQL integration tests, Prisma migration validation, security auditing, and the production Next.js build.

Run locally with:

```bash
npm run audit:app
```

Run the combined local quality gate with:

```bash
npm run quality
```
