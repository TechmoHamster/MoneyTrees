# Debt V2.2 Bills Integration Proof Verification

## Files changed in the app for the Bills portion
- `finance-dashboard/lib/types.ts`
- `finance-dashboard/lib/debt.ts`
- `finance-dashboard/lib/debt.test.ts`
- `finance-dashboard/components/FinanceDashboard.tsx`
- `finance-dashboard/components/BillsTable.tsx`
- `finance-dashboard/components/BillRow.tsx`
- `finance-dashboard/components/PaymentDetailsModal.tsx`

## Requirement-by-requirement status table
| Area | Status | Notes |
| --- | --- | --- |
| A. Debt-derived row typing / field support | partial | Most required row semantics are implemented, but `duplicateWarning` / `duplicateCandidateBillIds` are declared only and not populated or rendered. |
| B. Near-term window enforcement | complete | Debt-generated Bills rows are bounded to the next 60 calendar days in Debt-owned projection/schedule code. |
| C. Structural edit lock behavior | complete | Debt-derived rows cannot be structurally edited or deleted in Bills; edit routes to Debt and bulk structural actions block debt-derived rows. |
| D. Debt-linked UI treatment | complete | Bills shows debt-type visual treatment, details sub-row copy, route-to-Debt behavior, and operational-only messaging. |
| E. Payment status support | partial | `upcoming`, `partially_paid`, and `paid` are implemented in transformation and UI. Other statuses exist in types only and are not surfaced operationally in Bills UI. |
| F. Partial / failed / reversed payment handling | partial | Partial payment is supported through payment amount capture. Failed / reversed are represented in Debt lifecycle logic/tests, not as Bills UI actions or row states. |
| G. Payment event handoff back to Debt | partial | Debt reconsumes Bills payment and fee facts through derived lifecycle events. Bills does not emit a standalone structured payment-event bus for pending/failed/reversed outcomes. |
| H. Duplicate warning behavior | not implemented | Duplicate warning fields exist in types, but there is no row-level population or Bills UI display for them. |
| I. Acceptance criteria coverage | partial | The bounded bridge and structural boundaries are real. Full Bills-side workflow completion for the broader payment-status/event surface is not complete. |

## Proof snippets and file references

### A. Debt-derived row typing / field support — `partial`
Implemented in `finance-dashboard/lib/types.ts`:
- `sourceGenerated`
- `sourceDebtAccountId`
- `sourceDebtOccurrenceId`
- `sourceDebtType`
- `sourceDebtDisplayName`
- `sourceDebtProviderName`
- `sourceDebtTypeLabel`
- `sourceDebtStandingState`
- `sourceDebtArrangementOverlayLabels`
- `sourceDebtTrustState`
- `sourceDebtSourceQuality`
- `sourceDebtRouteTarget`
- `debtPaymentStatus`
- `debtObligationKind`
- `isStructuralEditLocked`
- `duplicateWarning`
- `duplicateCandidateBillIds`
- `sourceConflict`
- `conflictReason`

Populated in `finance-dashboard/lib/debt.ts` inside `buildDebtBillSemanticFields(...)` and `buildProjectedDebtBills(...)`:
- semantic fields populated at the row level
- conflict markers populated from Debt lifecycle conflicts
- debt-derived route target set to `debt_account_detail`

Gap:
- `duplicateWarning` and `duplicateCandidateBillIds` are declared in `lib/types.ts`, but this proof pass found no row-level population or Bills UI rendering for them.

### B. Near-term window enforcement — `complete`
Enforced in `finance-dashboard/lib/debt.ts`:
- `const DEBT_FORWARD_WINDOW_DAYS = 60;`
- `buildProjectedDebtBills(...)` projects only through that 60-day horizon
- `getBoundedOperationalScheduleEntries(...)` bounds the schedule used for downstream Bills and Debt snapshots
- `buildNearTermObligations(...)` uses that bounded schedule
- `buildLinkedScheduleFact(...)` explicitly states: `Bills receives bounded unpaid upcoming rows only.`

This is a real enforcement point in Debt-owned transformation logic, not just copy.

### C. Structural edit lock behavior — `complete`
Implemented in `finance-dashboard/components/FinanceDashboard.tsx`:
- single-row edit for debt-derived rows routes to `openDebtAccountFromBill(...)` instead of opening bill edit
- single-row delete is blocked with an alert and routes the user into Debt
- bulk category change excludes debt-derived rows and shows a Debt-owned message
- bulk delete excludes debt-derived rows and shows a Debt-owned message
- bulk status change blocks debt-only selections and keeps Mark Paid as the operational-only Bills path

Implemented in `finance-dashboard/components/BillRow.tsx`:
- debt-derived row actions show `Open in Debt` instead of `Edit`
- debt-derived rows do not show `Delete`

### D. Debt-linked UI treatment — `complete`
Implemented in Bills UI:
- `finance-dashboard/components/BillRow.tsx`
  - debt-derived rows are detected with `bill.sourceType === "debt-derived"`
  - row shows a debt-type chip when a linked debt account is present
  - `Show details` expands a dedicated `Debt Details` sub-row
  - details sub-row explains that the row is operational only and account truth stays in Debt
  - actions menu offers `Open in Debt`
- `finance-dashboard/components/BillsTable.tsx`
  - bulk-action panel contains explicit copy: `Debt-linked rows can still be marked paid or carry fee operations here, but structural edits stay owned by Debt.`

This is real UI treatment, not model-only work.

### E. Payment status support — `partial`
Declared in `finance-dashboard/lib/types.ts`:
- `upcoming`
- `pending`
- `partially_paid`
- `paid`
- `failed`
- `reversed`
- `skipped_approved`
- `canceled`

Actually transformed in `finance-dashboard/lib/debt.ts` via `getDebtBillsPaymentStatus(...)`:
- `paid`
- `partially_paid`
- `upcoming`

Current Bills UI support:
- `finance-dashboard/components/PaymentDetailsModal.tsx` captures paid date, amount, method, note
- `finance-dashboard/components/BillRow.tsx` renders payment details only for paid rows

Gap:
- `pending`, `failed`, `reversed`, `skipped_approved`, and `canceled` are not operationally set or displayed by Bills UI in this pass.

### F. Partial / failed / reversed payment handling — `partial`
Implemented:
- partial payment is supported by entering a payment amount lower than the total obligation in `PaymentDetailsModal.tsx`
- `lib/debt.ts` converts that into `partially_paid`
- `buildBillDerivedLifecycleEvents(...)` in `lib/debt.ts` emits `partial_payment_posted` and `payment_posted` based on Bills row payment data

Not implemented in Bills UI/workflow:
- no Bills control to set a row to `failed`
- no Bills control to set a row to `reversed`
- no Bills control to mark `pending`, `skipped_approved`, or `canceled`
- no row rendering for those statuses in Bills

Debt lifecycle/test layer does know about failed and reversed payment events, but Bills operational UI does not author those states.

### G. Payment event handoff back to Debt — `partial`
Implemented:
- `finance-dashboard/lib/debt.ts` seeds Debt lifecycle with `buildBillDerivedLifecycleEvents(account, bills)`
- derived events include:
  - `payment_posted`
  - `partial_payment_posted`
  - `late_fee_applied`
- Debt then reuses those derived events in lifecycle normalization and conflict detection

Not implemented:
- there is no standalone Bills-side emitter writing explicit structured Debt lifecycle events for `pending`, `failed`, or `reversed`
- the handoff is row-state-derived, not an explicit event integration channel

### H. Duplicate warning behavior — `not implemented`
What exists:
- `duplicateWarning` and `duplicateCandidateBillIds` in `finance-dashboard/lib/types.ts`
- Debt lifecycle duplicate-event suppression exists in `finance-dashboard/lib/debt.ts`, but that is Debt lifecycle history protection, not Bills row duplicate-warning behavior

What does not exist:
- row-level Bills duplicate warning population
- Bills duplicate-warning badge/copy
- Bills duplicate-resolution flow

### I. Acceptance criteria coverage — `partial`
| Acceptance area | Status | Notes |
| --- | --- | --- |
| Debt-derived row semantics attached to Bills rows | met | Implemented in `lib/types.ts` and `lib/debt.ts` |
| 60-day bounded near-term window | met | Enforced in `lib/debt.ts` |
| Structural edits blocked in Bills | met | Implemented in `FinanceDashboard.tsx` and `BillRow.tsx` |
| Debt-linked row UI treatment | met | Implemented in `BillRow.tsx` and `BillsTable.tsx` |
| Mark paid / fee capture on debt-derived rows | met | Supported through Bills actions and payment modal |
| Full payment-status surface in Bills UI | partially met | Only `upcoming`, `partially_paid`, `paid` are active |
| Failed / reversed operational handling in Bills UI | not met | Model/test support exists in Debt, not Bills UI |
| Explicit payment-event handoff channel to Debt | partially met | Derived from Bills row facts, not a richer event emitter |
| Duplicate warning display/handling | not met | Not implemented in Bills row mapping or UI |

## UI completed vs UI pending
### Completed in Bills UI
- debt-derived rows can be identified and inspected
- debt-derived rows can route into Debt
- debt-derived rows cannot be structurally edited/deleted in Bills
- Mark Paid / Update Payment is available
- late fee operational capture remains available
- details sub-row exists for debt details / fee breakdown / payment details

### Pending in Bills UI
- explicit `pending` / `failed` / `reversed` / `skipped_approved` / `canceled` controls
- row-level display for those broader payment statuses
- duplicate-warning row treatment
- richer quiet linked-row visuals beyond the current chip/details pattern

## Data/model completed vs pending
### Completed
- row semantics/types for debt-derived Bills rows
- bounded near-term schedule enforcement
- obligation kind mapping
- trust/source/conflict semantic attachment
- Debt-side derived lifecycle reconsumption from Bills payment facts

### Pending
- duplicate-warning row semantics are declared but not populated
- broader payment-status transformation beyond paid/partial/upcoming

## Event handoff completed vs pending
### Completed
- Bills payment facts (`status`, `paidDate`, `paidAmount`, `lateFeeAmount`) are reconsumed by Debt through derived lifecycle events

### Pending
- explicit operational handoff for pending/failed/reversed/skipped/canceled events
- dedicated event-channel or writeback path instead of row-state derivation only

## Final gap list
1. Populate and surface duplicate-warning row behavior if Bills requires that as a shipped capability.
2. Expand Bills operational status handling beyond paid/partial/upcoming if Bills is expected to author those states directly.
3. Add explicit failed/reversed/pending interaction flows in Bills if that belongs in Bills scope rather than Debt-only lifecycle input.
4. Decide whether the current row-state-derived handoff is sufficient, or whether Bills needs an explicit structured event handoff contract to Debt.
