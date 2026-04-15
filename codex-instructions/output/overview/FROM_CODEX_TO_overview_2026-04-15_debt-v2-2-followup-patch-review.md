Debt v2.2 follow-up patch for Overview is complete.

Summary
- Tightened Debt snapshot copy so it stays factual and user-facing.
- Routed Overview snapshot actions into more specific Debt destinations when supported.

Changed files
- components/DebtOverviewSnapshotSection.tsx
- components/FinanceDashboard.tsx
- components/DebtSection.tsx

Boundary notes
- Overview still only shows compact debt visibility.
- No local debt recommendation or urgency engine was introduced.

Proof package
- code review/debt-v2-2-followup-patch/

Validation
- npm run lint passed
- npm run test passed
- 102 tests passed
- npm run build passed
