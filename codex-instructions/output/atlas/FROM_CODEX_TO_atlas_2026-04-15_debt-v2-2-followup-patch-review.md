Debt v2.2 follow-up patch for Atlas is complete.

Summary
- Completed non-Exact trust-state tone downgrade handling for Estimated, Custom, Manual, and Stale debt facts.
- Removed remaining ranking-flavored debt explainability wording.
- Added proof coverage that no hidden scoring was introduced.

Changed files
- lib/advisor.ts
- lib/advisor.test.ts

Boundary notes
- Atlas still carries Debt-owned facts forward without recalculating them.
- No hidden debt scoring, trust override, or promo assumption engine was introduced.

Proof package
- code review/debt-v2-2-followup-patch/

Validation
- npm run lint passed
- npm run test passed
- 102 tests passed
- npm run build passed
