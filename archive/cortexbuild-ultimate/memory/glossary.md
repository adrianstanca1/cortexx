# Glossary

Decoder ring for workplace shorthand — acronyms, nicknames, project codenames, and internal terms.

## Construction-domain acronyms

| Term               | Meaning                                                                                                       | Notes                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **RAMS**           | Risk Assessments and Method Statements                                                                        | UK construction safety docs; a core module                     |
| **RFI**            | Request for Information                                                                                       | Construction workflow; has dedicated analysis agent            |
| **BIM**            | Building Information Modeling                                                                                 | 3D models of buildings                                         |
| **IFC**            | Industry Foundation Classes                                                                                   | Open BIM file format; rendered via `web-ifc` / `web-ifc-three` |
| **CO**             | Change Order                                                                                                  | Contract change workflow; has dedicated analysis agent         |
| **UK contractors** | Target customer segment — commercial / residential / industrial construction businesses in the United Kingdom |                                                                |

## Tech acronyms

| Term            | Meaning                                              | Notes                                                                   |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| **RBAC**        | Role-Based Access Control                            | Roles: super_admin, company_owner, admin, project_manager, field_worker |
| **RAG**         | Retrieval-Augmented Generation                       | `rag_embeddings` table + cosine similarity, pg_vector                   |
| **LLM**         | Large Language Model                                 | We use Ollama (local)                                                   |
| **MFA / TOTP**  | Multi-Factor Authentication / Time-based OTP         | Deferred to future phase                                                |
| **IDOR**        | Insecure Direct Object Reference                     | Prevented via org/company scoping; unauthorized → 404                   |
| **WCAG / a11y** | Web Content Accessibility Guidelines / accessibility | Target: 95+ Lighthouse a11y                                             |
| **PWA**         | Progressive Web App                                  | Deferred: offline-first field apps                                      |
| **OCR**         | Optical Character Recognition                        | Deferred: document pipeline                                             |
| **E2E**         | End-to-End testing                                   | Playwright                                                              |
| **CI/CD**       | Continuous Integration/Delivery                      | GitHub Actions + Husky hooks                                            |
| **PG / pg**     | PostgreSQL / node-postgres driver                    | Raw SQL via `pg` pool; Prisma is reference-only                         |

## Nicknames

| Nickname | Full Name | Role |
| -------- | --------- | ---- |

_No collaborators identified in docs yet — project appears to be a solo build by Adrian. Add as they appear._

## Project codenames

| Codename                   | Project                     | What it is                                                         |
| -------------------------- | --------------------------- | ------------------------------------------------------------------ |
| **CortexBuild Ultimate**   | CortexBuild Ultimate v3.0.0 | AI-powered unified construction management SaaS for UK contractors |
| **cortexbuildpro.com**     | Production frontend         | https://www.cortexbuildpro.com                                     |
| **cortexbuild-ultimate-1** | Secondary clone             | Local duplicate/staging copy — must stay in sync with canonical    |
| **CortexBuild API**        | Backend container           | `cortexbuild-api` Docker container on VPS                          |

## Internal terms / conventions

| Term                           | Meaning                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Generic CRUD**               | `server/routes/generic.js` factory (`makeRouter`) with SQL injection prevention via column whitelists, audit log, WS broadcast |
| **Multi-tenant / org scoping** | Every query filtered by `organization_id` and/or `company_id`                                                                  |
| **Lazy modules**               | 50+ `React.lazy()` loaded components in `src/App.tsx`                                                                          |
| **Superpowers plans**          | Step-by-step execution plans in `docs/superpowers/plans/`                                                                      |
| **Canonical repo**             | `cortexbuild-ultimate` (not the `-1` copy); canonical = source of truth                                                        |
| **VPS**                        | Production host `root@72.62.132.43` (Hostinger)                                                                                |

---

_Populated via `/productivity:start` bootstrap. Enriched by `/productivity:update`._
