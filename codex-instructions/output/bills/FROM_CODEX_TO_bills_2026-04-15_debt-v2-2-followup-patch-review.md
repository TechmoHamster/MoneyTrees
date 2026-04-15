Debt v2.2 follow-up patch for Bills is complete.

Summary
- Added quiet duplicate warnings for overlapping debt-derived and manual Debt rows.
- Expanded Bills-side operational debt payment statuses.
- Made Debt handoff back from Bills payment capture explicit and reviewable.

Changed files
- components/BillRow.tsx
- components/FinanceDashboard.tsx
- components/PaymentDetailsModal.tsx
- lib/debt.ts
- lib/types.ts
- lib/debt.test.ts

Boundary notes
- Bills still owns operational payment capture only.
- Debt still owns lifecycle interpretation, trust, standing, and schedule truth.
- No structural edit ownership drift was introduced.

Proof package
- code review/debt-v2-2-followup-patch/

Validation
- npm run lint passed
- npm run test passed
- 102 tests passed
- npm run build passed
