# UI and Accessibility Completion Program — 2026-09-28

## Release goal

CortexBuild Pro must ship with a zero-regression UI/accessibility baseline across the canonical Next.js application and the shipped legacy/offline PWA surfaces. Accessibility findings are release defects, not advisory backlog.

## Goals and acceptance gates

1. **Action safety — zero findings.** Every button declares its intent. Ordinary controls use `type="button"`; true form submissions use `type="submit"`. External links opened in a new tab use safe rel attributes. Static internal navigation targets resolve.
2. **Modern application accessibility — zero recommended JSX-a11y violations.** App Router pages and shared components must pass the recommended `eslint-plugin-jsx-a11y` rules.
3. **Offline/PWA accessibility — zero recommended JSX-a11y violations.** Shipped `lib/` screens must meet the same rule set, including keyboard-operable card actions, map/annotation alternatives, associated labels, meaningful image alternatives, and media transcripts/captions.
4. **Focus and input safety.** No forced `autoFocus` remains in audited UI. Form labels are programmatically associated with their controls. Dialogs retain explicit close controls; pointer-only backdrop dismissal is never the only exit.
5. **Keyboard parity for field-critical interaction.** Clickable cards, drawing annotations, photo annotations, file upload triggers, inline edit controls and map marking have a keyboard-operable path. Nested interactive controls are not hidden behind non-semantic clickable containers.
6. **Permanent regression prevention.** `audit:app` fails on any review finding. `lint:a11y` covers `app`, `components` and `lib` and runs in `quality` and GitHub CI with zero warnings allowed.
7. **Release regression gate.** TypeScript, lint, accessibility lint, integrity audit, unit tests, production build, desktop/mobile browser journeys and PWA journeys must pass before merge.
8. **Production gate.** Merge only through green CI. One.com deployment must use the exact merged SHA and finish healthy; public health and login routing must verify after cutover.

## Baseline and remediation

- Starting integrity review findings: **992**.
- Root cause of the original backlog: 990 implicit button types, one unsafe-new-tab finding, and one unresolved static navigation target.
- Original integrity findings after remediation: **0**.
- Strong modern UI accessibility findings discovered after enabling the recommended rules: **418**.
- Strong modern UI accessibility findings after remediation: **0**.
- Strong legacy/offline PWA accessibility findings discovered: **136**.
- Strong legacy/offline PWA accessibility findings after remediation: **0**.

The remediation uses semantic HTML and real keyboard behavior rather than rule suppression. Examples include native buttons for actions, native upload triggers, programmatically associated labels, explicit image alternatives, caption tracks backed by existing transcripts, keyboard drawing/map placement alternatives, and deterministic focus behavior.

## Ongoing rule

New UI/accessibility debt is not added to a baseline or deferred by warning count. A pull request that introduces an integrity or recommended accessibility finding fails CI and must resolve it before release.


## Runtime WCAG release gate

Static analysis is supplemented by rendered-browser accessibility checks using `@axe-core/playwright`.

The release gate covers:
- public authentication: login and registration;
- critical authenticated surfaces: dashboard, projects, tasks, documents, drawings, check-in, timesheets, site diary, snags, photos, safety, inspections, invoices and settings;
- open creation sheets/dialogs for projects, documents, check-in, timesheets, snags, safety incidents and inspections;
- desktop Chromium and mobile Chromium;
- WCAG 2.0/2.1 A and AA tags;
- zero retries and zero accepted violation baseline.

Runtime remediation completed in this pass includes:
- restored browser zoom/pinch scaling by removing the restrictive maximum-scale/user-scalable viewport settings;
- raised the secondary text token to an AA-safe contrast level across dark surfaces;
- corrected bright amber/green/purple/red action controls to use accessible dark foregrounds;
- corrected shared primary Button and SegmentedControl contrast;
- added missing accessible names to site diary, notification preferences and inspection controls;
- corrected mapped project-form label/control associations;
- replaced focusable full-screen backdrop divs with native backdrop buttons without adding spurious tab stops.

Final rendered result: all six accessibility E2E journeys pass on desktop and mobile with zero WCAG A/AA violations.
