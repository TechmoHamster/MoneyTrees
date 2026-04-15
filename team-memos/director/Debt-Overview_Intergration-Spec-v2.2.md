# Debt ↔ Overview Integration Spec v2.2

**MoneyTrees**  
**Prepared by:** Overview Team  
**For:** Director / Orion  
**Status:** Draft for implementation planning  
**Source:** Debt V2.2 Overview Field Contract  

---

## 1. Purpose

This spec defines the Debt V2.2 data metrics Overview intends to consume and display.

Overview will use Debt outputs for high-level visibility only.

Overview will not:
- calculate Debt values locally
- reinterpret Debt standing states
- define Debt urgency
- define thresholds
- rank Debt accounts
- duplicate Debt detail views
- provide recommendations

Core rule:

> Overview displays Debt facts. Debt defines Debt. Atlas interprets Debt.

---

## 2. Product Boundary

### Debt owns

Debt owns:
- debt math
- debt account truth
- lifecycle standing
- cure amounts
- debt schedules
- debt confidence / source-quality labels
- debt-specific calculations
- cash-window outputs
- delinquency and late-state logic

### Overview owns

Overview owns:
- quick-glance visibility
- presentation-only prioritization
- compact financial status display
- routing into the correct Debt views
- factual surface-level labels

### Atlas owns

Atlas owns:
- interpretation
- recommendations
- tradeoff framing
- next-step guidance

---

## 3. Recommended Overview Display Set

Overview should not display every Debt field. The page should remain compact and high-signal.

Recommended default display set:

1. Total Debt
2. Accounts Behind
3. Next Debt Payment
4. Debt Cash Needed — 30 Days
5. Accounts Requiring Review, only when non-zero

These should be presented in a compact Debt Snapshot module or equivalent high-level summary surface.

---

## 4. Primary Metrics

### 4.1 Total Debt

**Field:** `debt_total_balance`  
**Type:** Currency  
**Purpose:** Show aggregate outstanding Debt exposure.  
**Display:** Primary Debt Snapshot value.  
**Overview behavior:** Display only. Do not recalculate or adjust inclusion rules.

Recommended label:

> Total Debt

Possible compact copy:

> Total debt: $X

---

### 4.2 Active Debt Account Count

**Field:** `debt_active_account_count`  
**Type:** Integer  
**Purpose:** Show how many active Debt accounts exist.  
**Display:** Secondary supporting label, not necessarily a primary card.  
**Overview behavior:** Display only.

Recommended label:

> Active Accounts

Possible compact copy:

> X active accounts

---

### 4.3 Accounts Behind

**Primary field:** `debt_past_due_account_count`  
**Supporting fields:**
- `debt_late_account_count`
- `debt_delinquent_account_count`

**Type:** Integer  
**Debt definition:** `past_due_account_count = count(late + delinquent)`  
**Purpose:** Show how many Debt accounts are behind according to Debt-owned standing logic.  
**Overview behavior:** Display Debt-provided value only. Do not calculate locally.

Recommended label:

> Accounts Behind

Possible compact copy:

> X accounts behind

Important:
Overview may visually group late/delinquent signals, but it must not redefine them.

---

### 4.4 Next Debt Payment

**Object:** `next_debt_payment`

Object fields:
- `accountId`
- `accountName`
- `debtType`
- `dueDate`
- `dueAmount`
- `currency`
- `standingState`
- `routeTarget`

**Debt definition:** Earliest unpaid obligation by `dueDate`.  
**Purpose:** Show the next required Debt payment surfaced by Debt.  
**Overview behavior:** Display object as provided. No local sorting beyond consuming Debt’s selected object.

Recommended label:

> Next Debt Payment

Possible compact copy:

> $X due DATE — ACCOUNT

Empty behavior:
If `next_debt_payment` is null or unavailable, show minimal compact copy or omit the row/card.

---

### 4.5 Debt Cash Needed — 30 Days

**Primary field:** `debt_cash_required_30d`  
**Supporting available fields:**
- `debt_cash_required_14d`
- `debt_cash_required_60d`
- `debt_minimum_to_stay_current`
- `debt_total_past_due_amount`
- `debt_total_cure_amount`

**Type:** Currency  
**Purpose:** Show Debt-owned required cash need in the next 30 days.  
**Overview behavior:** Display Debt-provided 30-day value only. Do not calculate the window locally.

Recommended label:

> Debt Cash Needed — 30 Days

Possible compact copy:

> $X required in 30 days

Important:
Overview must not define “soon” independently. Use the explicit 30-day field label.

---

### 4.6 Accounts Requiring Review

**Field:** `debt_accounts_requiring_review_count`  
**Type:** Integer  
**Purpose:** Surface Debt accounts that Debt has flagged for review.  
**Display rule:** Show only when non-zero unless layout requires a stable placeholder.  
**Overview behavior:** Display only. Do not infer review status locally.

Recommended label:

> Needs Review

Possible compact copy:

> X accounts need review

---

## 5. Standing State Reference

Debt-provided enum:

`DebtStandingState`

Allowed values:
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

Overview may display these states only when helpful.

Overview must not:
- rename states in a way that changes meaning
- merge states into new semantic categories without Debt approval
- calculate status from dates or balances
- reinterpret standing severity

---

## 6. Confidence / Trust Indicators

Available fields:
- `trustState`
- `sourceQuality`
- `isStale`
- `requiresVerification`

Overview may show compact indicators only.

Recommended behavior:
- show indicators only when they affect trust or clarity
- keep copy factual
- route to Debt for detail
- avoid long explanation blocks

Possible compact labels:
- Limited
- Stale
- Verify
- Source conflict

Do not turn these into advisory copy.

---

## 7. Route Targets

Debt-provided `routeTarget` values:
- `debt_account_detail`
- `debt_accounts_list`
- `debt_activity`
- `bills_view`

Overview must route, not replicate detail.

Recommended routing:

| Overview Surface | Field / Object | Route Target |
|---|---|---|
| Total Debt | `debt_total_balance` | `debt_accounts_list` or Debt Briefing Hub if available |
| Accounts Behind | `debt_past_due_account_count` | `debt_accounts_list` filtered to late/delinquent if supported |
| Next Debt Payment | `next_debt_payment.routeTarget` | Use Debt-provided route target |
| Debt Cash Needed — 30 Days | `debt_cash_required_30d` | Debt schedule / cash-window view if available |
| Needs Review | `debt_accounts_requiring_review_count` | `debt_activity` or review-filtered Debt accounts |
| Trust indicators | `trustState`, `sourceQuality`, `isStale`, `requiresVerification` | Debt account detail or Debt activity |

If a route target is unavailable, route to the nearest Debt landing surface rather than duplicating detail in Overview.

---

## 8. Empty / Limited Data Behavior

### No Debt data

If no Debt accounts exist:
- show nothing, or
- show minimal compact copy only

Example:

> No debt accounts added yet.

Do not create a large empty-state panel.

### Limited Debt data

If Debt data exists but is limited:
- display the value if safe
- show compact “Limited” indicator
- route to Debt for detail

Example:

> Total Debt: $X · Limited

### Stale or verification-needed data

If `isStale` or `requiresVerification` is true:
- show compact indicator
- avoid interpretation
- route to Debt

Example:

> Debt data needs verification

---

## 9. UI Treatment Guidance

Recommended approach:

Create or update a compact **Debt Snapshot** surface.

Suggested contents:
- Total Debt
- Accounts Behind
- Next Debt Payment
- Debt Cash Needed — 30 Days
- Needs Review, only when non-zero

Rules:
- keep the module compact
- do not duplicate Debt detail views
- avoid adding many new panels
- avoid bloating the Overview page
- keep copy factual
- use routing for detail

The module should support scan speed and not compete with the primary Overview KPI row.

---

## 10. Copy Standard

Overview copy should be factual and compact.

Good copy:
- “Total debt: $X.”
- “X accounts behind.”
- “Next debt payment: $X due DATE.”
- “Debt cash required in 30 days: $X.”
- “X accounts need review.”
- “Debt data is limited.”

Avoid copy:
- “Pay this first.”
- “This is your top priority.”
- “Debt pressure is the main issue.”
- “You should focus on this.”
- “This account is risky.”
- “This is the best move.”

Recommendations belong to Atlas.

---

## 11. Prohibited Overview Logic

Overview must not:
- calculate urgency
- define “due soon”
- rank Debt accounts
- compute risk
- compute delinquency
- compute cure amounts
- compute cash-window totals
- override Debt standing states
- change Debt meaning through labels
- create hidden scoring or severity logic

If implementation requires any of the above, the output contract must be returned to Debt for clarification before implementation.

---

## 12. Implementation Acceptance Criteria

Implementation is acceptable only if:

- all displayed Debt metrics map directly to Debt-provided fields
- no local Debt meaning is derived in Overview
- no local Debt urgency/ranking logic exists in Overview
- routing sends users into Debt for detail
- empty states remain compact
- trust/source indicators are compact and factual
- Overview scan speed is preserved
- Atlas remains the interpretation layer

---

## 13. Codex Handoff Notes

When this moves to Codex, the implementation brief should instruct Codex to:

1. locate the Debt summary output interface
2. wire the approved fields into Overview state safely
3. add a compact Debt Snapshot treatment
4. avoid duplicating Debt account detail
5. preserve routing into Debt
6. preserve Overview’s presentation-only boundary
7. add empty and limited-data states
8. avoid hidden interpretation logic
9. report back any missing fields or ambiguous route targets

---

## 14. Final Rule

Overview should make Debt visible, not recreate Debt.

The user should be able to glance at Overview, see the Debt situation at a high level, and open Debt for detail or Atlas for interpretation.
