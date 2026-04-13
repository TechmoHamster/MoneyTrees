import type {
  AdvisorContext,
  AdvisorObjective,
  AdvisorObjectiveRecord,
  AdvisorPinnedScenario,
  AdvisorRecommendationLifecycleState,
  AdvisorRecommendationStateRecord,
  AdvisorReminder,
  AdvisorReminderType,
  AdvisorStrategyMode,
  AdvisorTrackingEvent,
  AdvisorTrackingEventType,
  AdvisorWatch,
  AdvisorWorkspaceState,
  CreditCardCustomMinimumRule,
  CreditCardCustomRuleOperationMode,
  CreditCardMinimumPaymentMode,
  CreditCardPaymentAssumptionMode,
  CreditCardPresetRuleId,
  DebtGracePeriodStatus,
  DebtAccount,
  DebtInterestAccrual,
  DebtLifecycleState,
  DebtPaymentCadence,
  DebtPaymentRequirement,
  DebtPromoType,
  DebtType,
  DashboardState,
} from "@/lib/types";
import { isValidDateOnly, normalizeAmount } from "@/lib/utils";

export const DEFAULT_DASHBOARD_STATE: DashboardState = {
  startingBalance: 1070,
  includePaidInTotals: false,
  bills: [],
  debtAccounts: [],
};

export function isDashboardState(value: unknown): value is DashboardState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<DashboardState>;
  return (
    typeof candidate.startingBalance === "number" &&
    Number.isFinite(candidate.startingBalance) &&
    typeof candidate.includePaidInTotals === "boolean" &&
    Array.isArray(candidate.bills)
  );
}

function isAdvisorStrategyMode(value: unknown): value is AdvisorStrategyMode {
  return (
    value === "reduce-overdue-count" ||
    value === "minimize-late-fees" ||
    value === "protect-essentials" ||
    value === "preserve-cash-buffer" ||
    value === "snowball" ||
    value === "avalanche"
  );
}

function isAdvisorTrackingEventType(value: unknown): value is AdvisorTrackingEventType {
  return (
    value === "analysis-run" ||
    value === "follow-recommendation" ||
    value === "follow-scenario"
  );
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function isAdvisorReminderType(value: unknown): value is AdvisorReminderType {
  return (
    value === "before-due-date" ||
    value === "after-payday" ||
    value === "recheck-run" ||
    value === "repeat-fee-risk" ||
    value === "stale-analysis"
  );
}

function isRecommendationLifecycleState(
  value: unknown,
): value is AdvisorRecommendationLifecycleState {
  return (
    value === "generated" ||
    value === "surfaced" ||
    value === "viewed" ||
    value === "saved" ||
    value === "snoozed" ||
    value === "acted-on" ||
    value === "resolved" ||
    value === "expired" ||
    value === "replaced" ||
    value === "not-possible-this-week"
  );
}

function isAdvisorObjective(value: unknown): value is AdvisorObjective {
  return (
    value === "reduce-late-fees" ||
    value === "protect-cash-buffer" ||
    value === "stabilize-essentials" ||
    value === "clear-past-due" ||
    value === "reduce-debt-drag" ||
    value === "prepare-large-bill" ||
    value === "preserve-goal-fund"
  );
}

function isDebtType(value: unknown): value is DebtType {
  return (
    value === "Credit Card" ||
    value === "Auto Loan" ||
    value === "Student Loan" ||
    value === "Installment Loan" ||
    value === "BNPL" ||
    value === "Financed Purchase"
  );
}

function isDebtPaymentCadence(value: unknown): value is DebtPaymentCadence {
  return value === "Monthly" || value === "Biweekly" || value === "Weekly";
}

function isDebtLifecycleState(value: unknown): value is DebtLifecycleState {
  return value === "Active" || value === "Deferment" || value === "Closed With Balance";
}

function isDebtPaymentRequirement(value: unknown): value is DebtPaymentRequirement {
  return value === "Payment Required" || value === "No Payment Required";
}

function isDebtInterestAccrual(value: unknown): value is DebtInterestAccrual {
  return value === "Interest Accruing" || value === "No Interest Accruing";
}

function isDebtPromoType(value: unknown): value is DebtPromoType {
  return value === "Intro APR" || value === "Deferred Interest";
}

function isDebtGracePeriodStatus(value: unknown): value is DebtGracePeriodStatus {
  return value === "Grace Period Active" || value === "Grace Period Lost";
}

function isCreditCardMinimumPaymentMode(value: unknown): value is CreditCardMinimumPaymentMode {
  return (
    value === "Preset Rule" ||
    value === "Custom Rule" ||
    value === "Manual Minimum Amount"
  );
}

function isCreditCardPaymentAssumptionMode(
  value: unknown,
): value is CreditCardPaymentAssumptionMode {
  return (
    value === "Minimum Due" ||
    value === "Statement Balance" ||
    value === "Total Balance" ||
    value === "Custom Amount"
  );
}

function isCreditCardPresetRuleId(value: unknown): value is CreditCardPresetRuleId {
  return (
    value === "greater-of-flat-or-percent-statement" ||
    value === "interest-fees-plus-percent-principal" ||
    value === "percent-of-statement-balance" ||
    value === "percent-of-current-balance" ||
    value === "full-balance-below-threshold" ||
    value === "flat-minimum-unless-smaller" ||
    value === "flat-minimum-plus-past-due" ||
    value === "percent-plus-interest-fees-past-due"
  );
}

function isCreditCardCustomRuleOperationMode(
  value: unknown,
): value is CreditCardCustomRuleOperationMode {
  return (
    value === "Percent Only" ||
    value === "Flat Only" ||
    value === "Percent Plus Flat" ||
    value === "Greater Of Flat Or Percent" ||
    value === "Lesser Of Flat Or Percent"
  );
}

function isCreditCardRuleVariable(
  value: unknown,
): value is CreditCardCustomMinimumRule["principalVariable"] {
  return (
    value === "statement_balance" ||
    value === "current_balance" ||
    value === "interest_charged" ||
    value === "fees_charged" ||
    value === "past_due_amount" ||
    value === "late_fee_amount" ||
    value === "promo_balance" ||
    value === "regular_purchase_balance" ||
    value === "cash_advance_balance" ||
    value === "balance_subject_to_minimum"
  );
}

function isAdvisorContext(value: unknown): value is AdvisorContext {
  return (
    value === "overview" ||
    value === "planning" ||
    value === "reporting" ||
    value === "all"
  );
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function normalizeOptionalAmount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? normalizeAmount(value) : undefined;
}

function normalizeOptionalDate(value: unknown): string | undefined {
  return typeof value === "string" && isValidDateOnly(value) ? value : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeCreditCardCustomRule(
  value: unknown,
): CreditCardCustomMinimumRule | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as Partial<CreditCardCustomMinimumRule>;
  if (
    typeof candidate.name !== "string" ||
    candidate.name.trim().length === 0 ||
    !isCreditCardRuleVariable(candidate.principalVariable) ||
    !isCreditCardCustomRuleOperationMode(candidate.operationMode)
  ) {
    return undefined;
  }

  return {
    name: candidate.name.trim(),
    principalVariable: candidate.principalVariable,
    operationMode: candidate.operationMode,
    percentageValue: normalizeOptionalAmount(candidate.percentageValue),
    fixedAmount: normalizeOptionalAmount(candidate.fixedAmount),
    thresholdAmount: normalizeOptionalAmount(candidate.thresholdAmount),
    useFullBalanceBelowThreshold: candidate.useFullBalanceBelowThreshold === true,
    includeInterestCharged: candidate.includeInterestCharged === true,
    includeFeesCharged: candidate.includeFeesCharged === true,
    includePastDueAmount: candidate.includePastDueAmount === true,
    includeLateFeeAmount: candidate.includeLateFeeAmount === true,
    includePromoBalance: candidate.includePromoBalance === true,
    includeRegularPurchaseBalance: candidate.includeRegularPurchaseBalance === true,
    includeCashAdvanceBalance: candidate.includeCashAdvanceBalance === true,
  };
}

export function normalizeTrackingEvents(value: unknown): AdvisorTrackingEvent[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const events = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const candidate = entry as Partial<AdvisorTrackingEvent>;
      if (
        typeof candidate.id !== "string" ||
        !isAdvisorTrackingEventType(candidate.type) ||
        typeof candidate.timestamp !== "number" ||
        !Number.isFinite(candidate.timestamp) ||
        !isAdvisorStrategyMode(candidate.strategy) ||
        !isAdvisorContext(candidate.context) ||
        !candidate.snapshot ||
        typeof candidate.snapshot !== "object"
      ) {
        return null;
      }

      const snapshot = candidate.snapshot as AdvisorTrackingEvent["snapshot"];
      if (
        typeof snapshot.balanceLeft !== "number" ||
        typeof snapshot.negativeAmount !== "number" ||
        typeof snapshot.pastDueCount !== "number" ||
        typeof snapshot.unpaidTotal !== "number" ||
        typeof snapshot.totalLateFees !== "number" ||
        typeof snapshot.dueIn7DaysCount !== "number" ||
        typeof snapshot.dueIn7DaysTotal !== "number"
      ) {
        return null;
      }

      return {
        id: candidate.id,
        type: candidate.type,
        timestamp: candidate.timestamp,
        context: candidate.context,
        strategy: candidate.strategy,
        sourceId:
          typeof candidate.sourceId === "string" && candidate.sourceId.trim().length > 0
            ? candidate.sourceId.trim()
            : undefined,
        sourceLabel:
          typeof candidate.sourceLabel === "string" && candidate.sourceLabel.trim().length > 0
            ? candidate.sourceLabel.trim()
            : undefined,
        shownRecommendationIds: Array.isArray(candidate.shownRecommendationIds)
          ? candidate.shownRecommendationIds.filter(
              (item): item is string => typeof item === "string" && item.trim().length > 0,
            )
          : undefined,
        shownRecommendationTypes: Array.isArray(candidate.shownRecommendationTypes)
          ? candidate.shownRecommendationTypes.filter(
              (item): item is NonNullable<AdvisorTrackingEvent["shownRecommendationTypes"]>[number] =>
                typeof item === "string",
            )
          : undefined,
        shownFocusBillIds: Array.isArray(candidate.shownFocusBillIds)
          ? candidate.shownFocusBillIds.filter(
              (item): item is string => typeof item === "string" && item.trim().length > 0,
            )
          : undefined,
        shownFocusCategories: Array.isArray(candidate.shownFocusCategories)
          ? candidate.shownFocusCategories.filter(
              (item): item is NonNullable<AdvisorTrackingEvent["shownFocusCategories"]>[number] =>
                typeof item === "string",
            )
          : undefined,
        shownScenarioTypes: Array.isArray(candidate.shownScenarioTypes)
          ? candidate.shownScenarioTypes.filter(
              (item): item is NonNullable<AdvisorTrackingEvent["shownScenarioTypes"]>[number] =>
                typeof item === "string",
            )
          : undefined,
        dataQualityLevel:
          candidate.dataQualityLevel === "Strong" ||
          candidate.dataQualityLevel === "Moderate" ||
          candidate.dataQualityLevel === "Sparse"
            ? candidate.dataQualityLevel
            : undefined,
        snapshot: {
          balanceLeft: normalizeAmount(snapshot.balanceLeft),
          negativeAmount: normalizeAmount(snapshot.negativeAmount),
          pastDueCount: snapshot.pastDueCount,
          unpaidTotal: normalizeAmount(snapshot.unpaidTotal),
          totalLateFees: normalizeAmount(snapshot.totalLateFees),
          dueIn7DaysCount: snapshot.dueIn7DaysCount,
          dueIn7DaysTotal: normalizeAmount(snapshot.dueIn7DaysTotal),
        },
      } satisfies AdvisorTrackingEvent;
    })
    .filter(isDefined)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 60);

  return events.length > 0 ? events : undefined;
}

function normalizeRecommendationStates(
  value: unknown,
): AdvisorRecommendationStateRecord[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const records = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const candidate = entry as Partial<AdvisorRecommendationStateRecord>;
      if (
        typeof candidate.recommendationId !== "string" ||
        candidate.recommendationId.trim().length === 0 ||
        typeof candidate.title !== "string" ||
        candidate.title.trim().length === 0 ||
        !isAdvisorContext(candidate.context) ||
        typeof candidate.recommendationType !== "string" ||
        !isRecommendationLifecycleState(candidate.state) ||
        (candidate.priority !== "Critical" &&
          candidate.priority !== "High" &&
          candidate.priority !== "Medium") ||
        !isIsoTimestamp(candidate.surfacedAt) ||
        !isIsoTimestamp(candidate.lastUpdatedAt)
      ) {
        return null;
      }

      return {
        recommendationId: candidate.recommendationId.trim(),
        title: candidate.title.trim(),
        context: candidate.context,
        recommendationType: candidate.recommendationType,
        state: candidate.state,
        priority: candidate.priority,
        focusBillId:
          typeof candidate.focusBillId === "string" && candidate.focusBillId.trim().length > 0
            ? candidate.focusBillId.trim()
            : undefined,
        focusCategory:
          typeof candidate.focusCategory === "string" && candidate.focusCategory.trim().length > 0
            ? candidate.focusCategory
            : undefined,
        whyNow:
          typeof candidate.whyNow === "string" && candidate.whyNow.trim().length > 0
            ? candidate.whyNow.trim()
            : undefined,
        note:
          typeof candidate.note === "string" && candidate.note.trim().length > 0
            ? candidate.note.trim()
            : undefined,
        pinnedToHub: candidate.pinnedToHub === true,
        reminderType: isAdvisorReminderType(candidate.reminderType)
          ? candidate.reminderType
          : undefined,
        reminderAt: isIsoTimestamp(candidate.reminderAt) ? candidate.reminderAt : undefined,
        snoozedUntil: isIsoTimestamp(candidate.snoozedUntil) ? candidate.snoozedUntil : undefined,
        surfacedAt: candidate.surfacedAt,
        lastUpdatedAt: candidate.lastUpdatedAt,
        resolvedAt: isIsoTimestamp(candidate.resolvedAt) ? candidate.resolvedAt : undefined,
      } satisfies AdvisorRecommendationStateRecord;
    })
    .filter(isDefined)
    .sort((left, right) => Date.parse(right.lastUpdatedAt) - Date.parse(left.lastUpdatedAt))
    .slice(0, 80);

  return records.length > 0 ? records : undefined;
}

function normalizePinnedScenarios(value: unknown): AdvisorPinnedScenario[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const scenarios = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const candidate = entry as Partial<AdvisorPinnedScenario>;
      if (
        typeof candidate.scenarioId !== "string" ||
        candidate.scenarioId.trim().length === 0 ||
        typeof candidate.title !== "string" ||
        candidate.title.trim().length === 0 ||
        !isAdvisorContext(candidate.context) ||
        typeof candidate.type !== "string" ||
        (candidate.priority !== "Best Fit" &&
          candidate.priority !== "Safest" &&
          candidate.priority !== "Useful" &&
          candidate.priority !== "Defensive") ||
        !isIsoTimestamp(candidate.pinnedAt)
      ) {
        return null;
      }

      return {
        scenarioId: candidate.scenarioId.trim(),
        title: candidate.title.trim(),
        context: candidate.context,
        priority: candidate.priority,
        type: candidate.type,
        bestFor:
          typeof candidate.bestFor === "string" && candidate.bestFor.trim().length > 0
            ? candidate.bestFor.trim()
            : undefined,
        tradeoffSummary:
          typeof candidate.tradeoffSummary === "string" &&
          candidate.tradeoffSummary.trim().length > 0
            ? candidate.tradeoffSummary.trim()
            : undefined,
        focusBillId:
          typeof candidate.focusBillId === "string" && candidate.focusBillId.trim().length > 0
            ? candidate.focusBillId.trim()
            : undefined,
        focusCategory:
          typeof candidate.focusCategory === "string" && candidate.focusCategory.trim().length > 0
            ? candidate.focusCategory
            : undefined,
        pinnedAt: candidate.pinnedAt,
      } satisfies AdvisorPinnedScenario;
    })
    .filter(isDefined)
    .sort((left, right) => Date.parse(right.pinnedAt) - Date.parse(left.pinnedAt))
    .slice(0, 40);

  return scenarios.length > 0 ? scenarios : undefined;
}

function normalizeWatches(value: unknown): AdvisorWatch[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const watches = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }
      const candidate = entry as Partial<AdvisorWatch>;
      if (
        typeof candidate.id !== "string" ||
        candidate.id.trim().length === 0 ||
        (candidate.kind !== "bill" &&
          candidate.kind !== "category" &&
          candidate.kind !== "repeat-fee-risk" &&
          candidate.kind !== "analysis-staleness") ||
        typeof candidate.label !== "string" ||
        candidate.label.trim().length === 0 ||
        (candidate.status !== "active" &&
          candidate.status !== "resolved" &&
          candidate.status !== "dismissed") ||
        !isIsoTimestamp(candidate.createdAt) ||
        !isIsoTimestamp(candidate.updatedAt)
      ) {
        return null;
      }

      return {
        id: candidate.id.trim(),
        kind: candidate.kind,
        label: candidate.label.trim(),
        status: candidate.status,
        focusBillId:
          typeof candidate.focusBillId === "string" && candidate.focusBillId.trim().length > 0
            ? candidate.focusBillId.trim()
            : undefined,
        focusCategory:
          typeof candidate.focusCategory === "string" && candidate.focusCategory.trim().length > 0
            ? candidate.focusCategory
            : undefined,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      } satisfies AdvisorWatch;
    })
    .filter(isDefined)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 50);

  return watches.length > 0 ? watches : undefined;
}

function normalizeReminders(value: unknown): AdvisorReminder[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const reminders = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }
      const candidate = entry as Partial<AdvisorReminder>;
      if (
        typeof candidate.id !== "string" ||
        candidate.id.trim().length === 0 ||
        !isAdvisorReminderType(candidate.type) ||
        typeof candidate.label !== "string" ||
        candidate.label.trim().length === 0 ||
        (candidate.status !== "scheduled" &&
          candidate.status !== "completed" &&
          candidate.status !== "dismissed") ||
        !isIsoTimestamp(candidate.createdAt) ||
        !isIsoTimestamp(candidate.updatedAt)
      ) {
        return null;
      }

      return {
        id: candidate.id.trim(),
        type: candidate.type,
        label: candidate.label.trim(),
        status: candidate.status,
        recommendationId:
          typeof candidate.recommendationId === "string" &&
          candidate.recommendationId.trim().length > 0
            ? candidate.recommendationId.trim()
            : undefined,
        scenarioId:
          typeof candidate.scenarioId === "string" && candidate.scenarioId.trim().length > 0
            ? candidate.scenarioId.trim()
            : undefined,
        focusBillId:
          typeof candidate.focusBillId === "string" && candidate.focusBillId.trim().length > 0
            ? candidate.focusBillId.trim()
            : undefined,
        focusCategory:
          typeof candidate.focusCategory === "string" && candidate.focusCategory.trim().length > 0
            ? candidate.focusCategory
            : undefined,
        scheduledFor: isIsoTimestamp(candidate.scheduledFor) ? candidate.scheduledFor : undefined,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      } satisfies AdvisorReminder;
    })
    .filter(isDefined)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 60);

  return reminders.length > 0 ? reminders : undefined;
}

function normalizeObjectives(value: unknown): AdvisorObjectiveRecord[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const objectives = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }
      const candidate = entry as Partial<AdvisorObjectiveRecord>;
      if (
        typeof candidate.id !== "string" ||
        candidate.id.trim().length === 0 ||
        !isAdvisorObjective(candidate.objective) ||
        typeof candidate.label !== "string" ||
        candidate.label.trim().length === 0 ||
        typeof candidate.isActive !== "boolean" ||
        !isIsoTimestamp(candidate.createdAt) ||
        !isIsoTimestamp(candidate.updatedAt)
      ) {
        return null;
      }

      return {
        id: candidate.id.trim(),
        objective: candidate.objective,
        label: candidate.label.trim(),
        isActive: candidate.isActive,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      } satisfies AdvisorObjectiveRecord;
    })
    .filter(isDefined)
    .sort((left, right) => Number(right.isActive) - Number(left.isActive))
    .slice(0, 12);

  return objectives.length > 0 ? objectives : undefined;
}

export function normalizeAdvisorWorkspace(value: unknown): AdvisorWorkspaceState | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const payload = value as Partial<AdvisorWorkspaceState>;
  const workspace = {
    recommendationStates: normalizeRecommendationStates(payload.recommendationStates),
    pinnedScenarios: normalizePinnedScenarios(payload.pinnedScenarios),
    watches: normalizeWatches(payload.watches),
    reminders: normalizeReminders(payload.reminders),
    objectives: normalizeObjectives(payload.objectives),
    lastOpenHubSection:
      typeof payload.lastOpenHubSection === "string" &&
      payload.lastOpenHubSection.trim().length > 0
        ? payload.lastOpenHubSection.trim()
        : undefined,
  } satisfies AdvisorWorkspaceState;

  if (
    !workspace.recommendationStates &&
    !workspace.pinnedScenarios &&
    !workspace.watches &&
    !workspace.reminders &&
    !workspace.objectives &&
    !workspace.lastOpenHubSection
  ) {
    return undefined;
  }

  return workspace;
}

function normalizeDebtAccounts(value: unknown): DebtAccount[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const accounts = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const candidate = entry as Partial<DebtAccount>;
      if (
        typeof candidate.id !== "string" ||
        candidate.id.trim().length === 0 ||
        typeof candidate.providerName !== "string" ||
        candidate.providerName.trim().length === 0 ||
        !isDebtType(candidate.debtType) ||
        typeof candidate.currentBalance !== "number" ||
        !Number.isFinite(candidate.currentBalance) ||
        !isDebtPaymentCadence(candidate.paymentCadence) ||
        !isDebtLifecycleState(candidate.lifecycleState) ||
        !isDebtPaymentRequirement(candidate.paymentRequirement) ||
        !isDebtInterestAccrual(candidate.interestAccrual)
      ) {
        return null;
      }

      return {
        id: candidate.id.trim(),
        providerName: candidate.providerName.trim(),
        issuerName: normalizeOptionalString(candidate.issuerName),
        debtType: candidate.debtType,
        currentBalance: normalizeAmount(candidate.currentBalance),
        originalAmount: normalizeOptionalAmount(candidate.originalAmount),
        statementBalance: normalizeOptionalAmount(candidate.statementBalance),
        statementMinimumDue: normalizeOptionalAmount(candidate.statementMinimumDue),
        apr: normalizeOptionalAmount(candidate.apr),
        creditLimit: normalizeOptionalAmount(candidate.creditLimit),
        interestCharged: normalizeOptionalAmount(candidate.interestCharged),
        feesCharged: normalizeOptionalAmount(candidate.feesCharged),
        pastDueAmount: normalizeOptionalAmount(candidate.pastDueAmount),
        daysPastDue:
          typeof candidate.daysPastDue === "number" &&
          Number.isInteger(candidate.daysPastDue) &&
          candidate.daysPastDue >= 0
            ? candidate.daysPastDue
            : undefined,
        lateFeeAmount: normalizeOptionalAmount(candidate.lateFeeAmount),
        promoType: isDebtPromoType(candidate.promoType) ? candidate.promoType : undefined,
        promoEndDate: normalizeOptionalDate(candidate.promoEndDate),
        promoBalance: normalizeOptionalAmount(candidate.promoBalance),
        regularPurchaseBalance: normalizeOptionalAmount(candidate.regularPurchaseBalance),
        cashAdvanceBalance: normalizeOptionalAmount(candidate.cashAdvanceBalance),
        gracePeriodStatus: isDebtGracePeriodStatus(candidate.gracePeriodStatus)
          ? candidate.gracePeriodStatus
          : undefined,
        termLengthMonths:
          typeof candidate.termLengthMonths === "number" &&
          Number.isInteger(candidate.termLengthMonths) &&
          candidate.termLengthMonths > 0
            ? candidate.termLengthMonths
            : undefined,
        totalPaymentCount:
          typeof candidate.totalPaymentCount === "number" &&
          Number.isInteger(candidate.totalPaymentCount) &&
          candidate.totalPaymentCount > 0
            ? candidate.totalPaymentCount
            : undefined,
        completedPaymentCount:
          typeof candidate.completedPaymentCount === "number" &&
          Number.isInteger(candidate.completedPaymentCount) &&
          candidate.completedPaymentCount >= 0
            ? candidate.completedPaymentCount
            : undefined,
        paymentCadence: candidate.paymentCadence,
        nextDueDate: normalizeOptionalDate(candidate.nextDueDate),
        minimumPayment: normalizeOptionalAmount(candidate.minimumPayment),
        scheduledPaymentAmount: normalizeOptionalAmount(candidate.scheduledPaymentAmount),
        minimumPaymentMode: isCreditCardMinimumPaymentMode(candidate.minimumPaymentMode)
          ? candidate.minimumPaymentMode
          : undefined,
        minimumPaymentPresetId: isCreditCardPresetRuleId(candidate.minimumPaymentPresetId)
          ? candidate.minimumPaymentPresetId
          : undefined,
        minimumPaymentCustomRule: normalizeCreditCardCustomRule(
          candidate.minimumPaymentCustomRule,
        ),
        paymentAssumptionMode: isCreditCardPaymentAssumptionMode(candidate.paymentAssumptionMode)
          ? candidate.paymentAssumptionMode
          : undefined,
        paymentAssumptionCustomAmount: normalizeOptionalAmount(
          candidate.paymentAssumptionCustomAmount,
        ),
        lastVerifiedAgainstStatement: normalizeOptionalDate(candidate.lastVerifiedAgainstStatement),
        lifecycleState: candidate.lifecycleState,
        paymentRequirement: candidate.paymentRequirement,
        interestAccrual: candidate.interestAccrual,
        isDelinquent: candidate.isDelinquent === true,
        notes: normalizeOptionalString(candidate.notes),
      } satisfies DebtAccount;
    })
    .filter(isDefined)
    .sort((left, right) => left.providerName.localeCompare(right.providerName, undefined, { sensitivity: "base" }));

  return accounts.length > 0 ? accounts : undefined;
}

export function normalizeDashboardState(payload: DashboardState): DashboardState {
  return {
    ...payload,
    startingBalance: normalizeAmount(payload.startingBalance),
    bills: payload.bills.map((bill) => ({
      ...bill,
      amount: normalizeAmount(bill.amount),
      lateFeeAmount:
        typeof bill.lateFeeAmount === "number" && Number.isFinite(bill.lateFeeAmount)
          ? normalizeAmount(bill.lateFeeAmount)
          : undefined,
      paidDate:
        typeof bill.paidDate === "string" && isValidDateOnly(bill.paidDate)
          ? bill.paidDate
          : undefined,
      paidAmount:
        typeof bill.paidAmount === "number" && Number.isFinite(bill.paidAmount)
          ? normalizeAmount(bill.paidAmount)
          : undefined,
      paymentMethod:
        typeof bill.paymentMethod === "string" && bill.paymentMethod.trim().length > 0
          ? bill.paymentMethod.trim()
          : undefined,
      paymentNote:
        typeof bill.paymentNote === "string" && bill.paymentNote.trim().length > 0
          ? bill.paymentNote.trim()
          : undefined,
      sourceType:
        bill.sourceType === "debt-derived" || bill.sourceType === "manual"
          ? bill.sourceType
          : undefined,
      sourceDebtAccountId:
        typeof bill.sourceDebtAccountId === "string" && bill.sourceDebtAccountId.trim().length > 0
          ? bill.sourceDebtAccountId.trim()
          : undefined,
      sourceDebtType: isDebtType(bill.sourceDebtType) ? bill.sourceDebtType : undefined,
      sourceDebtOccurrenceDate:
        typeof bill.sourceDebtOccurrenceDate === "string" &&
        isValidDateOnly(bill.sourceDebtOccurrenceDate)
          ? bill.sourceDebtOccurrenceDate
          : undefined,
    })),
    debtAccounts: normalizeDebtAccounts(payload.debtAccounts) ?? [],
    advisorTracking: normalizeTrackingEvents(payload.advisorTracking),
    advisorWorkspace: normalizeAdvisorWorkspace(payload.advisorWorkspace),
  };
}
