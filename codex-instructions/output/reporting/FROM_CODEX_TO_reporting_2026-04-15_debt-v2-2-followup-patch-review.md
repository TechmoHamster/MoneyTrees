Debt v2.2 follow-up patch for Reporting is complete.

Summary
- Removed remaining recommendation-style reporting wording.
- Added Debt snapshot export support.
- Corrected debt payment-event analysis to use payment posted dates when available.
- Softened debt analytical tone when confidence is degraded.

Changed files
- components/ReportingSection.tsx
- lib/utils.ts
- lib/debt.ts
- lib/types.ts
- lib/debt.test.ts

Boundary notes
- Reporting remains analytical and neutral.
- No debt-local recommendation logic or scoring was added.

Proof package
- code review/debt-v2-2-followup-patch/

Validation
- npm run lint passed
- npm run test passed
- 102 tests passed
- npm run build passed
