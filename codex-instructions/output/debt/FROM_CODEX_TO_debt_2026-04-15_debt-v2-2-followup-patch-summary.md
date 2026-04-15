Debt v2.2 follow-up patch is complete.

What was patched
- Bills: quiet duplicate warnings, broader operational debt payment statuses, and explicit event handoff back into Debt.
- Overview: more specific routing and cleaner factual copy.
- Reporting: neutralized remaining recommendation language, exported Debt snapshot data, and corrected payment-event date usage.
- Atlas: completed non-Exact trust-state tone downgrade handling and added stronger proof.

Changed files
- components/BillRow.tsx
- components/DebtOverviewSnapshotSection.tsx
- components/DebtSection.tsx
- components/FinanceDashboard.tsx
- components/PaymentDetailsModal.tsx
- components/ReportingSection.tsx
- lib/advisor.ts
- lib/advisor.test.ts
- lib/debt.ts
- lib/debt.test.ts
- lib/types.ts
- lib/utils.ts

Follow-up packages
- output/bills/code review/debt-v2-2-followup-patch/
- output/overview/code review/debt-v2-2-followup-patch/
- output/reporting/code review/debt-v2-2-followup-patch/
- output/atlas/code review/debt-v2-2-followup-patch/
- output/debt/code review/debt-v2-2-followup-patch/

Validation
- npm run lint passed
- npm run test passed
- 102 tests passed
- npm run build passed

Status
- Debt v2.2 follow-up patch is ready for team review.
