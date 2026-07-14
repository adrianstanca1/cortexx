# Dependency update policy

Dependency updates are automated through Dependabot and validated by the same full CI gate as product changes.

Patch and minor updates may be merged after the complete pipeline passes. Major updates are treated as migrations because they can change compiler, linter, runtime, framework, or generated-output behaviour. Major upgrades must remain isolated, resolve peer-dependency compatibility, and pass application integrity, lint, TypeScript, unit tests, Prisma checks, PostgreSQL integration tests, security audit, and production build before merge.

Grouped major upgrades should be split when one incompatible package prevents otherwise safe updates from shipping. Lockfiles must always be regenerated from the current `main` branch rather than conflict-resolved by hand.
