# TO_CODEX_FROM_debt_2026-04-14_debt-v2-2-cross-team-integration

**To:** Codex  
**From:** Debt Team + Director Orion consolidation  
**Date:** 2026-04-14  
**Subject:** Debt v2.2 Cross-Team Integration Brief  
**Status:** Ready for Codex implementation review  

---

## 0. Director Summary

Debt v2.2 is now ready for cross-team integration work.

This brief consolidates the four team-specific integration specs submitted for:

1. Debt → Atlas
2. Debt → Bills
3. Debt → Overview
4. Debt → Reporting

Codex should treat this as the master implementation brief for Debt v2.2 integration.

Core product model:

- **Debt owns debt truth, debt math, lifecycle standing, schedules, cash windows, trust/source quality, continuity, and debt-specific outputs.**
- **Bills owns operational bill/payment rows and payment capture.**
- **Overview owns compact visibility and routing only.**
- **Reporting owns analytical trends, comparisons, exports, and drill-down routing only.**
- **Atlas owns interpretation, recommendations, scenarios, tradeoffs, confidence language, and follow-through.**

Codex must not blur these boundaries.

---

## 1. Source Briefs Consolidated

This consolidated brief is based on the following team briefs:

- `team-memos/director/Debt-Atlas_Intergration-Spec-v2.2.txt`
- `team-memos/director/Debt-Bills_Intergration-Spec-v2.2.md`
- `team-memos/director/Debt-Overview_Intergration-Spec-v2.2.md`
- `team-memos/director/Debt-Reporting_Intergration-Spec-v2.2.txt`

If a detail is ambiguous, preserve the team boundary and flag the ambiguity in the returned review package rather than inventing behavior.

---

## 2. Global Non-Negotiables

Codex must preserve the following:

1. Debt does not become Atlas.
2. Bills does not become Debt.
3. Overview does not become Debt or Atlas.
4. Reporting does not become Atlas.
5. Atlas does not become a second Debt engine.
6. No section may introduce debt-local recommendation logic unless explicitly owned by Atlas.
7. No section may introduce hidden urgency, priority, severity, pressure, or risk scoring.
8. Debt-owned states, labels, schedules, trust flags, continuity fields, and lifecycle outputs must remain Debt-owned.
9. If data is limited, stale, estimated, custom, manual, or source-conflicted, preserve that caveat.
10. Do not fake precision.

---

## 3. Debt → Atlas Integration

### 3.1 Purpose

Atlas must consume Debt v2.2 truth and turn it into careful interpretation, recommendations, and tradeoff framing without duplicating Debt-owned logic.

This is a context, confidence, phrasing, and test-alignment pass. It is not a broad Atlas expansion.

### 3.2 Approved Atlas Context Fields

For each debt account, Atlas may consume:

- `debtType`
- `balance`
- `minimumDue`
- `dueDate`
- `standingState`
- `daysPastDue`
- `cureAmount`
- `nextEscalationDate`
- `arrangementOverlays`
- `failedPaymentCount`
- `reversedPaymentCount`
- `sourceQuality`
- `trustState`

Event explanation fields:

- `lastPaymentEvent`
- `lastFailedPaymentEvent`
- `lastStandingChange`
- `lastArrangementChange`

Continuity fields:

- `predecessorAccountId`
- `successorAccountId`
- `continuityType`

Promo / interest fields:

- `promoActive`
- `promoEndDate`
- `deferredInterest`

Trust states:

- `Exact`
- `Custom`
- `Estimated`
- `Limited`
- `Manual`
- `Stale`

Important:

- `standingState` = lifecycle position
- `minimumDue` = obligation requirement

Atlas must not merge these concepts.

### 3.3 Required Atlas Work

Codex should:

1. Update Atlas facts / advisor context contracts to include or confirm approved Debt v2.2 fields.
2. Keep Debt fields clearly labeled as Debt-owned upstream facts.
3. Update Atlas context builders to consume the shared Debt downstream snapshot.
4. Preserve `trustState`, `sourceQuality`, event fields, continuity fields, and promo/deferred-interest fields.
5. Add trust/tone handling:
   - `Exact` may use normal confidence language.
   - `Custom`, `Estimated`, `Limited`, `Manual`, and `Stale` must downgrade tone.
6. Preserve Debt caveats in user-facing explanations.
7. Add Debt-aware phrasing safeguards.

Allowed phrasing patterns:

- “Debt shows...”
- “Debt marks...”
- “Debt reports...”
- “Based on Debt’s current standing state...”
- “Debt indicates this account is behind by X.”
- “Debt marks this output as limited / estimated / source-conflicted.”

Avoid/prohibit:

- “Debt recommends...”
- “Debt decided...”
- “Debt scored this...”
- “Debt knows this is your best move...”
- “This is guaranteed...”

### 3.4 Atlas-Specific Rules

Atlas must not:

- calculate new debt severity
- redefine Debt states
- override Debt trust
- recalculate `cureAmount`
- recalculate `standingState`
- reinterpret `sourceQuality`
- flatten continuity chains into a single account truth
- assume missing promo or interest terms
- use Debt flags as hidden priority scores

### 3.5 Atlas Acceptance Criteria

Atlas integration passes only if:

- all approved Debt context fields are consumable
- Debt labels and caveats are preserved
- confidence/tone downgrades when trustState is not `Exact`
- Atlas does not recompute Debt-owned fields
- Atlas does not create separate Debt scoring/severity
- Atlas output remains traceable to Debt facts
- event summary fields are explanation-only
- continuity fields are not flattened
- promo/deferred-interest fields are not over-assumed
- tests or review notes confirm boundary compliance

Likely areas to inspect:

- advisor facts / contracts
- advisor context builders
- advisor service layer
- Atlas recommendation explanation logic
- Atlas trust / confidence logic
- Atlas UI copy where Debt facts surface
- advisor tests

---

## 4. Debt → Bills Integration

### 4.1 Purpose

Implement Debt-derived Bills rows so Debt can send bounded near-term payment obligations into Bills without Bills becoming a debt-management surface.

Core boundary:

- Debt owns lifecycle meaning.
- Bills records payment reality.
- Bills stays table-first, operational, compact, and traceable.

### 4.2 Near-Term Window Rule

Debt sends only bounded near-term obligations to Bills.

Default window:

- today through the next 60 calendar days

Bills must render only rows provided by Debt. Bills must not generate additional debt schedule rows.

Included:

- unpaid scheduled debt obligations
- unpaid upcoming minimum payments
- unpaid BNPL / financed purchase installments
- unpaid loan installments
- unpaid credit-card required payments when Debt has enough data
- cure-related operational obligations only when Debt emits them as distinct obligation rows

Excluded:

- paid rows
- historical rows
- full lifetime schedules beyond 60 days
- lifecycle-only events
- payoff scenarios
- projected optional extra payments
- advisory action suggestions

### 4.3 Required Bills Row Shape

Codex should add or support a Debt-derived Bills row model with these semantics:

```ts
type DebtDerivedBillsRow = {
  id: string
  source: "debt"
  sourceGenerated: true
  sourceDebtAccountId: string
  sourceDebtOccurrenceId: string
  sourceDebtScheduleId?: string
  sourceDebtEventId?: string
  sourceDebtType: DebtType
  sourceDebtDisplayName: string

  dueDate: string
  dueAmount: number
  currency: string
  paymentStatus: DebtBillsPaymentStatus
  obligationKind: DebtBillsObligationKind
  isDebtDerived: true
  isStructuralEditLocked: true

  accountNickname?: string
  providerName?: string
  debtTypeLabel?: string
  standingState?: DebtStandingState
  arrangementOverlayLabels?: string[]
  trustState?: DebtTrustState
  sourceQuality?: DebtSourceQuality
  routeTarget: DebtBillsRouteTarget

  paidAmount?: number
  paidDate?: string
  paymentMethod?: string
  paymentNote?: string
  paymentEventId?: string
  paymentPostedDate?: string
  paymentRecordedDate?: string

  feeAmount?: number
  feeType?: "late_fee" | "returned_payment_fee" | "other_fee"
  feeEventId?: string

  duplicateWarning?: boolean
  duplicateCandidateBillIds?: string[]
  sourceConflict?: boolean
  conflictReason?: string
}
```

If the existing Bill model is extended instead, preserve the same field semantics.

Required enums:

```ts
type DebtBillsPaymentStatus =
  | "upcoming"
  | "pending"
  | "partially_paid"
  | "paid"
  | "failed"
  | "reversed"
  | "skipped_approved"
  | "canceled"

type DebtBillsObligationKind =
  | "scheduled_installment"
  | "minimum_payment"
  | "bnpl_installment"
  | "financed_purchase_installment"
  | "cure_payment"
  | "arrangement_payment"
  | "returned_payment_fee"
  | "late_fee"

type DebtBillsRouteTarget =
  | "debt_account_detail"
  | "debt_schedule_detail"
  | "debt_activity_event"
  | "bills_row_detail"
```

### 4.4 Allowed Bills Actions

Debt-derived rows may allow:

- mark paid
- mark partial payment
- mark payment pending
- mark payment failed
- mark payment reversed
- add paid amount
- add paid date
- add payment method
- add payment note
- add operational fee event
- inspect linked Debt account
- route to Debt detail

These actions must be operational payment actions only.

### 4.5 Blocked Structural Actions

Bills must block editing of:

- source debt account identifiers
- debt type
- debt account balance
- APR
- term length
- minimum-payment rule
- lifecycle standing
- arrangement overlay
- payoff assumption
- source-quality label
- continuity chain
- schedule-generation rules
- Debt-generated due amount unless explicitly overrideable by Debt
- Debt-generated due date unless explicitly overrideable by Debt

Allowed blocked-edit copy:

- “Managed by Debt”
- “Edit account in Debt”
- “Debt controls this schedule”

### 4.6 Payment Event Handoff Back to Debt

When Bills captures payment activity on a Debt-derived row, emit an operational event back to Debt.

```ts
type DebtBillsPaymentEvent = {
  eventId: string
  source: "bills"
  sourceDebtAccountId: string
  sourceDebtOccurrenceId: string
  billsRowId: string
  eventType: DebtBillsPaymentEventType
  amount?: number
  paymentDate?: string
  postedDate?: string
  recordedDate: string
  paymentMethod?: string
  note?: string
  feeAmount?: number
  feeType?: string
}

type DebtBillsPaymentEventType =
  | "payment_pending"
  | "payment_posted"
  | "partial_payment_posted"
  | "payment_failed"
  | "payment_reversed"
  | "late_fee_applied"
  | "returned_payment_fee_applied"
```

Debt determines satisfaction, remaining cure amount, lifecycle standing impact, delinquency impact, arrangement impact, and event timeline updates.

Bills must not infer those outcomes.

### 4.7 Bills-Specific Rules

- Partial payments should remain on one operational row unless Debt emits multiple rows.
- Failed/reversed payments must preserve history and emit events back to Debt.
- Returned-payment fees and late fees are operational fee events unless Debt emits separate obligations.
- Duplicate detection should be quiet, non-destructive, and warning-based.
- Bills must not silently merge, delete, or suppress Debt-derived rows.

### 4.8 Bills Acceptance Criteria

Bills integration passes only if:

- Debt-derived rows can be represented in Bills
- source fields are preserved
- structural edits are blocked
- operational payment actions remain available
- partial / failed / reversed statuses are supported
- payment events can be emitted back to Debt
- returned-payment and late-fee events are represented operationally
- duplicate warnings are visible but non-destructive
- Bills does not calculate lifecycle meaning
- Bills remains table-first and compact

Likely files to inspect:

- `lib/types.ts`
- `lib/utils.ts`
- `lib/dashboard-state.ts`
- `components/BillsTable.tsx`
- `components/BillRow.tsx`
- `components/PaymentDetailsModal.tsx`
- `components/BillForm.tsx`
- `components/FinanceDashboard.tsx`

---

## 5. Debt → Overview Integration

### 5.1 Purpose

Overview consumes Debt outputs for high-level visibility only.

Core rule:

> Overview displays Debt facts. Debt defines Debt. Atlas interprets Debt.

### 5.2 Recommended Overview Display Set

Overview should stay compact and high-signal.

Recommended Debt Snapshot fields:

1. Total Debt
2. Accounts Behind
3. Next Debt Payment
4. Debt Cash Needed — 30 Days
5. Accounts Requiring Review, only when non-zero

### 5.3 Primary Overview Metrics

#### Total Debt

- Field: `debt_total_balance`
- Display label: `Total Debt`
- Display only. Do not recalculate.

#### Active Debt Account Count

- Field: `debt_active_account_count`
- Label: `Active Accounts`
- Secondary supporting label, not necessarily a primary card.

#### Accounts Behind

- Primary field: `debt_past_due_account_count`
- Supporting fields:
  - `debt_late_account_count`
  - `debt_delinquent_account_count`
- Debt definition: past_due = late + delinquent
- Overview must display Debt-provided values only.

#### Next Debt Payment

Object: `next_debt_payment`

Fields:

- `accountId`
- `accountName`
- `debtType`
- `dueDate`
- `dueAmount`
- `currency`
- `standingState`
- `routeTarget`

Debt definition: earliest unpaid obligation by `dueDate`.

Overview must use the Debt-selected object. No local sorting beyond consuming it.

#### Debt Cash Needed — 30 Days

- Primary field: `debt_cash_required_30d`
- Supporting fields:
  - `debt_cash_required_14d`
  - `debt_cash_required_60d`
  - `debt_minimum_to_stay_current`
  - `debt_total_past_due_amount`
  - `debt_total_cure_amount`

Overview must display the Debt-provided 30-day value only. Do not calculate windows locally.

#### Accounts Requiring Review

- Field: `debt_accounts_requiring_review_count`
- Show only when non-zero unless layout requires a stable placeholder.
- Do not infer review status locally.

### 5.4 Standing State Reference

Debt-provided `DebtStandingState` values:

- `current`
- `grace_window`
- `late`
- `delinquent`
- `cured`
- `closed_with_balance`
- `charged_off`
- `collections`
- `resolved`
- `paid_off`
- `inactive`

Overview may display these only when useful, but must not rename, merge, calculate, or reinterpret them.

### 5.5 Confidence / Trust Indicators

Available fields:

- `trustState`
- `sourceQuality`
- `isStale`
- `requiresVerification`

Overview may show compact indicators only:

- `Limited`
- `Stale`
- `Verify`
- `Source conflict`

Do not turn these into advisory copy.

### 5.6 Overview Routing

Overview must route into Debt, not replicate detail.

Recommended route handling:

- Total Debt → Debt accounts list or Debt Briefing Hub
- Accounts Behind → Debt accounts filtered to late/delinquent if available
- Next Debt Payment → use Debt-provided `routeTarget`
- Debt Cash Needed — 30 Days → Debt schedule / cash-window view if available
- Needs Review → Debt activity or review-filtered Debt accounts
- Trust indicators → Debt detail or Debt activity

If a target is unavailable, route to the nearest Debt landing surface.

### 5.7 Overview Acceptance Criteria

Overview integration passes only if:

- displayed Debt metrics map directly to Debt-provided fields
- no local Debt meaning is derived in Overview
- no local Debt urgency/ranking logic exists in Overview
- routing sends users into Debt for detail
- empty states remain compact
- trust/source indicators are compact and factual
- Overview scan speed is preserved
- Atlas remains the interpretation layer

Likely implementation work:

1. Locate Debt summary output interface.
2. Wire approved fields into Overview state safely.
3. Add compact Debt Snapshot treatment.
4. Avoid duplicating Debt detail.
5. Preserve routing into Debt.
6. Add empty and limited-data states.
7. Report missing fields or ambiguous route targets.

---

## 6. Debt → Reporting Integration

### 6.1 Purpose

Reporting consumes Debt v2.2 as an upstream structured data source for analytical visibility only.

Reporting should improve:

- KPI visibility
- trends
- comparisons
- breakdowns
- concentration reads
- trust-aware analytical context
- exports
- drill-down routing

Core rule:

> Observed change → comparison baseline → analytical meaning. Stop there.

### 6.2 Debt Outputs Reporting May Consume

Account-level facts:

- debt type
- current balance
- original balance where available
- APR / active rate where available
- credit limit where relevant
- scheduled payment / minimum due
- next due date
- account status
- standing state
- arrangement overlay state

Lifecycle / payment behavior facts:

- standing-state transitions
- arrangement start/end events
- hardship / deferment / forbearance counts
- late / delinquent / cured transitions
- failed payment counts
- reversed payment counts
- partial payment counts
- cure amount changes
- days-past-due changes
- collections / charge-off / settlement state changes

Term / projection facts:

- APR changes
- promo expiration events
- capitalization events
- payment recast events
- term extension / shortening events
- payoff projection confidence where available
- projected remaining interest where reliable

Continuity facts:

- transfer events
- refinance events
- consolidation events
- servicer transfer events
- predecessor / successor account links
- continuity conflict flags

Trust / data-quality facts:

- `trustState`
- `sourceQuality`
- stale data flags
- limited confidence flags
- source conflict flags
- verification-needed flags
- missing-data flags

Cash-window facts:

- 14-day debt cash requirement
- 30-day debt cash requirement
- 60-day debt cash requirement
- minimum needed to stay current
- amount needed to cure
- past-due amount

### 6.3 Snapshot vs Event Semantics

Snapshot/current-state only:

- balance
- minimumDue
- dueDate
- standingState
- trustState

Event-history fields:

- payment events
- standing transitions
- arrangement events
- continuity events

Rules:

- Do not trend snapshot fields unless historical capture exists.
- Do not present current-state-only values as period trends.
- Snapshot outputs may be shown as current-state context.
- Event-history outputs may be trended only when valid in-range timestamps exist.
- Any module blending snapshot and event data must label the distinction clearly.

### 6.4 Canonical Timestamps

Use Debt timestamps:

- lifecycle events: `eventEffectiveDate`
- payment events: `paymentPostedDate`

Apply the same attribution rule to current and comparison periods.

### 6.5 Cash-Window Rules

Debt cash windows are snapshot-based.

Do not retroactively recalculate prior periods from current cash-window outputs.

Treat 14/30/60-day cash requirements as point-in-time/current context unless Debt provides historical capture.

### 6.6 Continuity Rules

Default:

- predecessor and successor accounts are separate accounts.

Optional advanced behavior only if Debt provides safe reconciliation support:

- grouped continuity view

Rules:

- do not double-count balances
- do not hide continuity conflicts
- surface unresolved continuity as analytical context, not advice

### 6.7 Trust / Confidence Handling

Rules:

- Limited or Stale must downgrade insight certainty.
- Source conflicts must be visible where they affect interpretation.
- Missing-data / verification-needed flags should surface as analytical context when relevant.
- Do not hide low-confidence signals.
- Do not make strong claims from stale or limited-confidence data.

Acceptable copy:

- “Three debt accounts were marked verification-needed, which limits confidence in some debt reporting outputs.”

Bad copy:

- “You should verify these accounts now.”

### 6.8 Debt KPIs to Add or Prepare

Prepare debt-focused KPI surfaces for:

- total debt balance
- debt balance delta vs comparison window where historical capture exists
- debt cash required in selected/current window
- past-due debt amount
- accounts in delinquent standing states
- failed / reversed payment count
- amount needed to cure
- stale / limited-confidence debt account count
- source-conflict / verification-needed count
- largest debt-type concentration

KPI requirements:

- neutral labels
- no recommendation copy
- no priority framing
- no local scoring
- show delta only when valid historical/comparison data exists
- label snapshot-only KPIs clearly when needed

### 6.9 Analytical Modules to Add or Prepare

Codex should add or prepare support for:

- Debt balance trend
- Debt type distribution / concentration
- Payment behavior trend
- Late / delinquent trend
- Arrangement overlay trend
- Interest / fee trend where reliable
- Promo / deferred-interest analysis
- Cash-pressure trend/context
- Continuity analysis
- Trust / data-quality analysis

### 6.10 Reporting Acceptance Criteria

Reporting integration passes only if:

- snapshot fields are not trended without historical capture
- event-history fields use canonical timestamps
- cash windows are treated as snapshot-based unless historical capture exists
- trust/confidence limitations affect insight tone
- exports preserve stable fields and labels only
- no Debt logic is recreated inside Reporting
- no debt recommendations appear inside Reporting
- no local scoring or priority ranking is introduced
- Reporting remains analytical only

---

## 7. Cross-Team Integration Sequence

Codex should approach the work in this order:

1. Inspect existing Debt v2.2 structures and downstream output contracts.
2. Confirm available Debt snapshot/event interfaces.
3. Update shared types/contracts where required.
4. Implement/prep Bills integration bridge for Debt-derived operational rows.
5. Implement/prep Overview compact Debt Snapshot consumption.
6. Implement/prep Reporting Debt analytical consumption.
7. Implement/prep Atlas Debt context consumption and tone/trust handling.
8. Add tests or explicit review notes proving boundary compliance.
9. Produce team-specific follow-up report + code review packages.

If any required Debt output is missing, ambiguous, or not safely typed, Codex must flag it instead of inventing a local substitute.

---

## 8. Required Code Review / Follow-Up Output Packages

Codex must save a follow-up report + code review package to each relevant team’s output folder.

Required output files:

1. `codex-instructions/output/atlas/FROM_CODEX_TO_atlas_2026-04-14_debt-v2-2-integration-review.md`
2. `codex-instructions/output/bills/FROM_CODEX_TO_bills_2026-04-14_debt-v2-2-integration-review.md`
3. `codex-instructions/output/overview/FROM_CODEX_TO_overview_2026-04-14_debt-v2-2-integration-review.md`
4. `codex-instructions/output/reporting/FROM_CODEX_TO_reporting_2026-04-14_debt-v2-2-integration-review.md`
5. `codex-instructions/output/debt/FROM_CODEX_TO_debt_2026-04-14_debt-v2-2-cross-team-integration-summary.md`

Each team-specific review package must include:

- concise summary of implemented changes
- files changed for that team’s surface/domain
- boundary compliance notes
- known blockers / missing fields / ambiguous contracts
- testing performed or explicit test gaps
- confirmation that no prohibited ownership drift was introduced
- screenshots if UI was changed
- lint/test/build status if available

Debt summary package must include:

- overall implementation summary
- cross-team contract changes
- unresolved integration risks
- list of each team output package created
- any follow-up required from Debt before teams can approve

---

## 9. Prohibited Work

Codex must not:

- build a new cross-system pressure/risk engine
- add debt-local recommendation/scoring behavior
- make Bills responsible for Debt lifecycle outcomes
- make Overview calculate Debt meaning
- make Reporting prescribe actions
- make Atlas recalculate Debt-owned facts
- flatten continuity chains without Debt-owned reconciliation
- invent missing APR/promo/cure/schedule fields
- redesign major UI surfaces unless required for safe integration
- introduce OpenAI / LLM behavior
- change unrelated app architecture

---

## 10. UI / UX Quality Requirements

UI/UX quality is part of implementation acceptance, not optional polish.

Codex must build the Debt v2.2 integrations in a way that preserves the current product’s visual clarity, section identity, and user flow quality.

The implementation should not merely be technically correct.
It should also be usable, readable, compact, responsive, and visually consistent with the existing MoneyTrees app.

Codex must avoid shipping integrations that technically work but create:

- bloated cards
- cramped tables
- confusing copy
- duplicate panels
- unclear routing
- oversized empty states
- poor mobile behavior
- weak visual hierarchy
- section identity drift

### 10.1 Preserve Section Identity

#### Bills

Bills must remain:

- table-first
- operational
- compact
- scannable
- payment-focused
- traceable

Debt-derived rows should feel like normal Bills rows with clear source linkage, not like a Debt dashboard embedded inside Bills.

Good Bills UX:

- clear `Linked to Debt` / `Managed by Debt` markers
- compact row treatment
- predictable table behavior
- quiet blocked-edit messaging
- payment actions remain easy to find
- route to Debt for account-level details

Bad Bills UX:

- large Debt info panels inside the table
- advisory language in Bills rows
- cluttered rows with too many Debt fields
- structural Debt editing inside Bills
- duplicate account-detail behavior

#### Overview

Overview must remain:

- compact
- high-signal
- quick-scan
- factual
- routing-oriented

The Debt Snapshot must support fast understanding without becoming a mini Debt dashboard.

Good Overview UX:

- compact Debt Snapshot module
- limited number of high-value fields
- clear labels
- no oversized empty states
- routes to Debt for detail
- routes to Atlas for interpretation where appropriate

Bad Overview UX:

- too many Debt cards
- duplicated Debt details
- advisory phrasing
- hidden urgency/ranking logic
- large panels that weaken the top-level dashboard hierarchy

#### Reporting

Reporting must remain:

- analytical
- comparative
- period-aware
- structured
- neutral

Debt Reporting modules should clarify trends and comparisons without becoming Debt advice.

Good Reporting UX:

- neutral KPI labels
- clear period attribution
- visible snapshot vs event distinction
- trust/confidence labels where relevant
- drill-down into Debt for record detail
- charts only when they add clarity

Bad Reporting UX:

- recommendation-style cards
- priority wording
- charts that imply more confidence than the data supports
- trend views built from snapshot-only fields
- bloated modules with unclear comparison baselines

#### Atlas

Atlas must remain:

- clear
- grounded
- traceable
- recommendation-focused
- confidence-aware
- not overloaded

Debt context should make Atlas more useful, not noisier.

Good Atlas UX:

- careful debt-aware explanation
- preserved Debt caveats
- plain-English confidence limits
- no fake certainty
- no internal scoring language exposed to the user
- concise recommendation support

Bad Atlas UX:

- too many debt-heavy explanations
- exaggerated urgency
- vague debt references
- hidden scoring language
- overconfident language when Debt trust is Limited, Manual, Estimated, Custom, or Stale

### 10.2 Mobile / Responsive Requirements

Codex must preserve mobile usability for any UI surfaces touched by this integration.

Requirements:

- avoid excessive vertical card growth on mobile
- avoid forcing wide Debt fields into cramped table cells
- keep important labels readable
- keep primary actions reachable
- preserve scan speed
- ensure routing controls are tappable and clear
- avoid dense technical copy on small screens

If a field cannot fit cleanly on mobile, use one of the following patterns:

- compact label + expanded detail
- row sub-detail
- tooltip / info affordance where appropriate
- route to Debt detail instead of overloading the host section

Do not solve mobile complexity by dumping all Debt fields into the visible card/table row.

### 10.3 Empty / Limited Data UX

Codex must implement empty, limited, stale, and verification-needed states cleanly.

Rules:

- empty states should be compact
- limited data states should be honest
- stale data should be visible but not dramatic
- verification-needed states should route to Debt for detail
- missing data should not create broken-looking cards
- no fake precision should appear in copy or layout

Acceptable patterns:

- `No Debt-linked bills in this window.`
- `Debt data is limited.`
- `Debt data needs verification.`
- `Some Debt values are estimated.`

Avoid:

- large placeholder panels
- scary language unsupported by data
- long technical explanation blocks
- silent fallback math that looks exact

### 10.4 Copy / Label Requirements

Codex must keep integration copy clean and user-readable.

Global copy rules:

- use plain English
- keep labels short
- preserve Debt-owned meaning
- do not expose internal implementation jargon unless already part of the product language
- avoid recommendation phrasing outside Atlas
- avoid vague “smart” language

Preferred patterns:

- `Linked to Debt`
- `Managed by Debt`
- `Edit account in Debt`
- `Debt data is limited`
- `Debt shows this account as behind`
- `Debt cash needed — 30 days`

Avoid:

- `Debt recommends`
- `Priority debt`
- `Most urgent`
- `Attack this first`
- `This is your best move`
- `Debt scored this`
- `High risk` unless backed by approved system output and surfaced in the correct section

### 10.5 Visual Hierarchy Requirements

Any added Debt integration UI must respect existing page hierarchy.

Rules:

- do not let Debt-derived content dominate host sections
- do not add visually heavy panels unless necessary
- keep secondary metadata visually secondary
- keep trust/source indicators compact
- keep routing controls clear but not oversized
- use progressive disclosure for dense Debt details

Codex should prefer:

- compact cards
- subtle badges
- expandable row details
- concise helper copy
- direct route links

Codex should avoid:

- oversized alert blocks
- dense all-fields-visible cards
- duplicate KPI rows
- dashboard-like Debt summaries inside non-Debt sections

### 10.6 Team-Specific UI/UX Acceptance Criteria

#### Bills UI/UX passes only if:

- Debt-derived rows remain compact and table-native
- payment actions are still easy to use
- source linkage is visible but not noisy
- blocked structural edits are clearly explained
- partial / failed / reversed states are readable
- duplicate warnings are quiet and non-destructive
- Bills does not feel like a Debt detail page

#### Overview UI/UX passes only if:

- Debt Snapshot is compact
- only the approved high-level metrics are surfaced by default
- empty states do not consume large space
- trust indicators stay short
- all detail exploration routes into Debt
- Overview remains fast to scan

#### Reporting UI/UX passes only if:

- Debt KPIs are neutral and analytical
- period/comparison context is clear
- snapshot-only fields are labeled correctly
- charts earn their footprint
- sparse/limited data states feel intentional
- no recommendation tone appears

#### Atlas UI/UX passes only if:

- Debt context improves recommendations without bloating them
- caveats are clear and plain-English
- confidence tone matches Debt trust state
- explanations remain traceable
- scenarios do not imply unsupported precision
- Atlas remains the advisor, not a Debt calculator

### 10.7 Screenshots / Review Package Requirement

If Codex changes any visible UI, the relevant team output package must include screenshots or screenshot notes for:

- desktop view if affected
- mobile view if affected or reasonably impacted
- empty / limited data state if added
- any new card/table/row/detail treatment

If screenshots cannot be produced, Codex must explicitly state why and describe the expected visual behavior.

Each team-specific output package must include a UI/UX review section with:

- what UI changed
- why it was necessary
- how it preserves the team’s section identity
- whether mobile was reviewed
- any remaining UX concerns

### 10.8 Implementation Priority

Codex should prioritize implementation quality in this order:

1. preserve data truth and ownership boundaries
2. preserve trust/source caveats
3. preserve section identity
4. preserve UI clarity and scan speed
5. preserve mobile usability
6. preserve clean routing and progressive disclosure

Do not sacrifice trust or ownership boundaries for UI convenience.
Do not sacrifice usability by exposing every available Debt field everywhere.

---

## 11. Final Acceptance Standard

The Debt v2.2 integration is acceptable only if:

- Debt truth remains Debt-owned.
- Bills remains operational and table-first.
- Overview remains compact and factual.
- Reporting remains analytical only.
- Atlas remains interpretive/recommendation-focused without becoming Debt.
- Trust/source caveats flow downstream without being lost.
- Snapshot vs event semantics are preserved.
- No section introduces hidden scoring, duplicated advice, or ownership drift.
- Codex returns review packages to every team output folder listed above.

Final rule:

> Debt defines the truth.  
> Bills records operational reality.  
> Overview surfaces the snapshot.  
> Reporting explains the pattern.  
> Atlas recommends the move.  

— Orion, Director
