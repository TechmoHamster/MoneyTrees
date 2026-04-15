# TO_CODEX_FROM_debt_2026-04-15_debt-v2-2-followup-patch

**To:** Codex  
**From:** Debt Team + Director Orion consolidation  
**Date:** 2026-04-15  
**Subject:** Debt v2.2 Follow-Up Patch Brief  
**Status:** Narrow completion pass authorized  

---

## 0. Director Summary

This brief is a follow-up patch instruction for Debt v2.2 integration work.

It replaces broad exploratory work with a narrow completion pass based on direct reviews from:

- Bills
- Overview
- Reporting
- Atlas

Working conclusion across all four teams:

- the Debt integration direction is real
- the bridges are materially implemented
- ownership boundaries are mostly preserved
- the work is not fully complete yet
- the correct next move is a narrow patch, not a rebuild

Codex should treat this as a **completion / cleanup pass only**.

Do not reopen broad architecture.
Do not redesign the product.
Do not expand scope beyond the issues listed here.

---

## 1. Source Review Memos

This follow-up patch brief is based on the following memos:

- `team-memos/director/FROM_bills_TO_director_2026-04-15_debt-v2-2-status-and-codex-request.txt`
- `team-memos/director/FROM_overview_TO_director_2026-04-15_debt-integration-review-and-codex-followup.txt`
- `team-memos/director/FROM_reporting_TO_director_2026-04-15_codex-review-debt-v2-2.txt`
- `team-memos/director/FROM_atlas_TO_director_2026-04-14_debt-v2-2-review.txt`

This brief should be read alongside the prior Debt v2.2 cross-team integration brief and its UI/UX direction.

---

## 2. Global Follow-Up Rule

This is a refinement pass.

Codex must:

- preserve all correct existing bridge work
- preserve current ownership boundaries
- patch incomplete areas only
- provide explicit proof for each item closed
- improve review-package quality

Codex must not:

- rework already-valid bridge layers without reason
- broaden feature scope
- add new scoring / priority / urgency engines
- redesign section identities
- reopen the Debt product model debate

---

## 3. Bills Follow-Up Patch Scope

Bills review conclusion:

The Debt -> Bills bridge is real and materially implemented, but Bills workflow completion is still partial.

### Bills patch items

Codex must complete or explicitly close out:

1. **Duplicate warning behavior**
   - implement quiet, non-destructive duplicate warnings for debt-derived vs manual bill conflicts
   - do not auto-merge or auto-delete rows
   - provide visible proof of the warning behavior

2. **Broader Bills-side payment status support**
   - complete Bills workflow handling where appropriate for:
     - `pending`
     - `failed`
     - `reversed`
     - `skipped_approved`
     - `canceled`
   - preserve Bills as an operational payment surface only

3. **Payment event handoff back to Debt**
   - make the event handoff more explicit and reviewable
   - show proof that payment actions emit the expected operational events back to Debt

4. **Acceptance closeout**
   - return explicit proof for each remaining Bills requirement still marked partial

### Bills follow-up rule

Do not rework the bridge/model layer broadly.
Treat this as completion of remaining workflow gaps only.

---

## 4. Overview Follow-Up Patch Scope

Overview review conclusion:

The Debt Snapshot direction is correct, compact, and boundary-safe, but one small follow-up pass is still recommended.

### Overview patch items

Codex must patch:

1. **Routing refinement**
   - make routing more specific where supported instead of routing too broadly into Debt
   - preferred examples:
     - Accounts Behind -> Debt accounts filtered to late/delinquent if supported
     - Debt Cash Needed -> Debt cash-window or schedule view if supported
     - Accounts Requiring Review -> Debt activity or review-filtered accounts if supported

2. **Copy cleanup**
   - remove any empty-state or helper copy that sounds internal / system-facing instead of product-facing
   - keep copy factual, compact, and user-readable

3. **Adapter cleanup where safe**
   - reduce adapter-side derivation where straightforward
   - prefer end-to-end consumption of explicit Debt-owned summary outputs
   - do not create risk by forcing purity where the contract is not safely available yet

### Overview follow-up rule

Do not rebuild the Debt Snapshot.
Preserve the current compact structure and boundary-safe direction.

---

## 5. Reporting Follow-Up Patch Scope

Reporting review conclusion:

The Debt bridge itself is mostly good, but Reporting as a whole still contains legacy policy violations and incomplete proof areas.

### Reporting patch items

Codex must patch:

1. **Remove remaining priority / decision / recommendation language**
   - remove legacy phrases such as:
     - `Immediate priority`
     - `should be cleared before anything else`
     - `Decision-oriented read`
   - remove any similar priority / next-step / action-plan language still present in Reporting

2. **Remove or refactor Reporting-owned priority helper logic**
   - eliminate any remaining Reporting helper behavior that implies local priority, action ordering, or decision support
   - Reporting must remain analysis-only

3. **Debt-aware export support**
   - confirm or implement export support for Debt-specific reporting fields where intended
   - ensure exports remain analytical and respect active reporting range and labels

4. **Payment-event timestamp handling**
   - explicitly prove or correct handling of debt payment-event analysis using `paymentPostedDate`
   - do not rely only on lifecycle `eventEffectiveDate`

5. **Trust / confidence-aware analytical tone**
   - improve analytical tone softening when Debt confidence is degraded
   - ensure stale / limited / source-conflict states do not still produce overly strong analytical claims

6. **Sparse-data / time-range cleanup**
   - resolve remaining sparse-data and time-range fallback inconsistencies
   - preserve Reporting’s time/comparison consistency rules

7. **Review package quality**
   - include real diffs in the returned review package
   - do not return empty diff artifacts

### Reporting follow-up rule

Treat this as a cleanup pass for policy compliance plus missing proof, not as a new Reporting feature pass.

---

## 6. Atlas Follow-Up Patch Scope

Atlas review conclusion:

The current pass is boundary-safe, but still looks like a shallow safe wiring pass rather than a fully completed Debt v2.2 Atlas integration.

### Atlas patch items

Codex must patch:

1. **Trust-state handling completion**
   - confirm and implement tone downgrade handling across all non-Exact trust states:
     - `Custom`
     - `Estimated`
     - `Limited`
     - `Manual`
     - `Stale`
   - prove the behavior clearly

2. **Language cleanup**
   - remove remaining scoring-flavored / ranking-flavored Atlas copy
   - keep Atlas aligned with plain-English, non-hidden-scoring language standards

3. **Contract test expansion**
   - strengthen tests or explicit review proof for:
     - trust downgrade handling across all non-Exact states
     - standing state vs minimum due separation
     - continuity preservation
     - event fields staying explanation-only
     - non-assumption around promo / deferred-interest behavior

4. **Hidden scoring confirmation**
   - explicitly confirm Atlas is not silently promoting Debt flags into hidden priority logic

5. **Review package clarity**
   - improve the file-level review package so it is easier to audit

### Atlas follow-up rule

Do not redesign Atlas.
Do not create a broader Debt advisor expansion.
Treat this as a refinement / completion patch only.

---

## 7. Cross-Team UI / UX Requirement For This Patch

Even though this is a narrow patch pass, Codex must still preserve good UI/UX.

Follow-up changes must not introduce:

- bloated UI
- visual noise
- new duplicate panels
- broad routing clutter
- internal-sounding product copy
- weak mobile behavior
- hidden complexity exposed in the UI

Patch-specific UX expectations:

- Bills warnings stay quiet and row-native
- Overview routing improvements remain compact and not visually heavy
- Reporting cleanup removes bossy / action-like language and improves analytical clarity
- Atlas language cleanup reduces scoring flavor and improves trust readability

If UI changes are made, include screenshots or screenshot notes in the output packages.

---

## 8. Required Return Packages

Codex must return updated follow-up review packages to each team output folder.

Required output files:

1. `codex-instructions/output/bills/FROM_CODEX_TO_bills_2026-04-15_debt-v2-2-followup-patch-review.md`
2. `codex-instructions/output/overview/FROM_CODEX_TO_overview_2026-04-15_debt-v2-2-followup-patch-review.md`
3. `codex-instructions/output/reporting/FROM_CODEX_TO_reporting_2026-04-15_debt-v2-2-followup-patch-review.md`
4. `codex-instructions/output/atlas/FROM_CODEX_TO_atlas_2026-04-15_debt-v2-2-followup-patch-review.md`
5. `codex-instructions/output/debt/FROM_CODEX_TO_debt_2026-04-15_debt-v2-2-followup-patch-summary.md`

Each team-specific package must include:

- concise summary of what was patched
- files changed for that team’s surface/domain
- proof for each requested follow-up item
- boundary compliance notes
- known blockers still remaining
- tests performed or explicit test gaps
- screenshots / screenshot notes if UI changed
- lint/test/build status if available
- real diffs or clear file-level change references

Debt summary package must include:

- overall patch summary
- per-team status
- unresolved blockers if any remain
- list of all output packages created
- recommendation on whether the integration is now complete or still partial

---

## 9. Final Acceptance Standard

This follow-up patch passes only if:

- Bills closes the remaining workflow gaps without reopening bridge architecture
- Overview routing/copy issues are cleaned up without bloating the page
- Reporting removes legacy decision-style behavior and closes export/timestamp/proof gaps
- Atlas completes trust-state handling, language cleanup, stronger tests, and hidden-scoring confirmation
- review packages are materially stronger than the last round
- section identity and ownership boundaries remain intact

Final rule:

> Preserve what is already correct.  
> Patch only what is still incomplete.  
> Return explicit proof.  
> Close the remaining gaps cleanly.  

— Orion, Director
