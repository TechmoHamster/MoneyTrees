import type {
  Bill,
  BillStatus,
  DebtAccount,
  DebtArrangementOverlay,
  DebtLifecycleEvent,
  DebtLifecyclePolicy,
  DebtLifecycleSnapshot,
  DebtDownstreamAccountFact,
  DebtDownstreamObligation,
  DebtDownstreamSnapshot,
  DebtCashWindow,
  DebtConsequenceItem,
  DebtDerivedMetrics,
  DebtFactualFlag,
  DebtLinkedScheduleFact,
  DebtMathInspectableItem,
  DebtMathTrustState,
  DebtPaymentCadence,
  DebtPaymentAssumptionFact,
  DebtPayoffProjection,
  DebtPayoffScenario,
  DebtScheduleItem,
  DebtSourceConflict,
  DebtSourceQuality,
  DebtStandingState,
  DebtSummary,
  DebtTermVersion,
  DebtTimingCluster,
} from "@/lib/types";
import { buildCreditCardMinimumSystem } from "@/lib/debt-credit-card";
import {
  formatCurrency,
  formatDate,
  getBillLateFeeAmount,
  getBillTotalAmount,
  isValidDateOnly,
  normalizeAmount,
} from "@/lib/utils";

const DEBT_FORWARD_WINDOW_DAYS = 60;
const DEBT_EXTRA_PAYMENT_OPTIONS = [50, 100, 200] as const;
const DEBT_CASH_WINDOW_DAYS = [14, 30, 60] as const;
const MAX_PROJECTION_PERIODS = 1_200;

export const DEBT_POLICY = {
  operationalWindowDays: DEBT_FORWARD_WINDOW_DAYS,
  promoExpiringSoonDays: 30,
  dueSoonDays: 14,
  paymentDueSoonDays: 7,
  highUtilizationThreshold: 80,
  timingClusterGapDays: 7,
} as const;

export const DEBT_LIFECYCLE_POLICY_DEFAULTS: DebtLifecyclePolicy = {
  graceWindowDays: 3,
  lateThresholdDays: 1,
  delinquencyThresholdDays: 30,
  hardshipPausesStandingProgression: true,
  temporarySkipPausesStandingProgression: true,
  partialPaymentAllocationRule: "fees-then-past-due-then-scheduled",
  lateFeesCountTowardCure: true,
};

export const DEBT_OPERATIONAL_WINDOW_DAYS = DEBT_POLICY.operationalWindowDays;

type DateOnlyParts = {
  year: number;
  month: number;
  day: number;
};

function parseDateOnly(dateString: string): DateOnlyParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const nextDate = new Date(year, month - 1, day);

  if (
    nextDate.getFullYear() !== year ||
    nextDate.getMonth() !== month - 1 ||
    nextDate.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function getDateOnly(dateString: string): Date | null {
  const parsed = parseDateOnly(dateString);
  if (!parsed) {
    return null;
  }

  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getToday(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate());
}

function addCadence(date: Date, cadence: DebtPaymentCadence): Date {
  if (cadence === "Weekly") {
    return addDays(date, 7);
  }

  if (cadence === "Biweekly") {
    return addDays(date, 14);
  }

  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate());
}

function getPeriodsPerYear(cadence: DebtPaymentCadence): number {
  if (cadence === "Weekly") {
    return 52;
  }

  if (cadence === "Biweekly") {
    return 26;
  }

  return 12;
}

function getDebtScheduledAmount(account: DebtAccount): number {
  if (account.debtType === "Credit Card") {
    if (typeof account.minimumPayment === "number" && account.minimumPayment > 0) {
      return normalizeAmount(account.minimumPayment);
    }

    if (typeof account.statementMinimumDue === "number" && account.statementMinimumDue > 0) {
      return normalizeAmount(account.statementMinimumDue);
    }

    return 0;
  }

  if (typeof account.scheduledPaymentAmount === "number" && account.scheduledPaymentAmount > 0) {
    return normalizeAmount(account.scheduledPaymentAmount);
  }

  if (typeof account.minimumPayment === "number" && account.minimumPayment > 0) {
    return normalizeAmount(account.minimumPayment);
  }

  return 0;
}

function hasInstallmentStructure(account: DebtAccount): boolean {
  return (
    account.debtType !== "Credit Card" &&
    (typeof account.termLengthMonths === "number" ||
      typeof account.totalPaymentCount === "number")
  );
}

function getPaymentAmountTrustState(account: DebtAccount, scheduledAmount: number): DebtMathTrustState {
  if (scheduledAmount <= 0) {
    return "Limited";
  }

  const hasScheduledPayment =
    typeof account.scheduledPaymentAmount === "number" && account.scheduledPaymentAmount > 0;
  const hasMinimumPayment =
    typeof account.minimumPayment === "number" && account.minimumPayment > 0;
  const hasFixedInstallmentContext = hasInstallmentStructure(account);
  const scheduleOverridesMinimum =
    hasScheduledPayment &&
    hasMinimumPayment &&
    normalizeAmount(account.scheduledPaymentAmount as number) !==
      normalizeAmount(account.minimumPayment as number);

  if (account.debtType === "Credit Card") {
    if (scheduleOverridesMinimum) {
      return "Custom";
    }

    if (hasMinimumPayment) {
      return "Limited";
    }

    return hasScheduledPayment ? "Manual" : "Limited";
  }

  if (scheduleOverridesMinimum) {
    return "Custom";
  }

  if (hasScheduledPayment && hasFixedInstallmentContext && account.interestAccrual === "No Interest Accruing") {
    return "Exact";
  }

  if (hasScheduledPayment && hasFixedInstallmentContext) {
    return "Estimated";
  }

  if (hasScheduledPayment) {
    return "Manual";
  }

  if (hasMinimumPayment) {
    return "Estimated";
  }

  return "Limited";
}

function getInterestModelTrustState(account: DebtAccount): DebtMathTrustState {
  if (account.interestAccrual === "No Interest Accruing") {
    return "Exact";
  }

  if (typeof account.apr === "number" && account.apr > 0) {
    return account.debtType === "Credit Card" ? "Limited" : "Estimated";
  }

  return "Limited";
}

function getProjectionTrustState(
  account: DebtAccount,
  paymentAmountTrustState: DebtMathTrustState,
): DebtMathTrustState {
  if (account.debtType === "Credit Card") {
    return "Limited";
  }

  if (account.interestAccrual === "No Interest Accruing") {
    return paymentAmountTrustState;
  }

  if (paymentAmountTrustState === "Custom") {
    return "Custom";
  }

  if (paymentAmountTrustState === "Manual") {
    return "Manual";
  }

  return "Estimated";
}

function getScenarioTrustState(
  account: DebtAccount,
  paymentAmountTrustState: DebtMathTrustState,
): DebtMathTrustState {
  if (account.debtType === "Credit Card") {
    return "Limited";
  }

  if (account.interestAccrual === "No Interest Accruing") {
    return paymentAmountTrustState;
  }

  if (paymentAmountTrustState === "Custom") {
    return "Custom";
  }

  if (paymentAmountTrustState === "Manual") {
    return "Manual";
  }

  return "Estimated";
}

function getDebtRemainingPaymentCount(account: DebtAccount, scheduledAmount: number): number | undefined {
  if (
    typeof account.totalPaymentCount === "number" &&
    typeof account.completedPaymentCount === "number"
  ) {
    return Math.max(0, account.totalPaymentCount - account.completedPaymentCount);
  }

  if (scheduledAmount > 0 && account.debtType !== "Credit Card" && account.currentBalance > 0) {
    return Math.ceil(account.currentBalance / scheduledAmount);
  }

  return undefined;
}

function shouldSuppressDebtProjectionForContinuity(
  account: DebtAccount,
  knownAccountIds?: Set<string>,
): boolean {
  const continuity = account.continuity;

  if (
    !continuity?.successorAccountId ||
    !continuity.continuityEffectiveDate ||
    !continuity.continuityEventType
  ) {
    return false;
  }

  if (knownAccountIds && !knownAccountIds.has(continuity.successorAccountId)) {
    return false;
  }

  const effectiveDate = getDateOnly(continuity.continuityEffectiveDate);
  if (!effectiveDate || effectiveDate > getToday()) {
    return false;
  }

  if (
    continuity.continuityEventType !== "balance_transfer" &&
    continuity.continuityEventType !== "refinance" &&
    continuity.continuityEventType !== "consolidation" &&
    continuity.continuityEventType !== "servicer_transfer" &&
    continuity.continuityEventType !== "debt_sale" &&
    continuity.continuityEventType !== "account_replacement"
  ) {
    return false;
  }

  if (typeof continuity.transferredAmount !== "number") {
    return false;
  }

  return normalizeAmount(continuity.transferredAmount) >= normalizeAmount(account.currentBalance);
}

function shouldProjectDebtAccount(account: DebtAccount, knownAccountIds?: Set<string>): boolean {
  if (account.currentBalance <= 0) {
    return false;
  }

  if (shouldSuppressDebtProjectionForContinuity(account, knownAccountIds)) {
    return false;
  }

  if (account.lifecycleState === "Deferment") {
    return false;
  }

  if (account.paymentRequirement === "No Payment Required") {
    return false;
  }

  if (!account.nextDueDate || !isValidDateOnly(account.nextDueDate)) {
    return false;
  }

  return getDebtScheduledAmount(account) > 0;
}

function getDebtBillName(account: DebtAccount): string {
  return account.providerName.trim();
}

function getDebtProjectionLimit(account: DebtAccount, remainingCount: number | undefined): number {
  if (typeof remainingCount === "number") {
    return Math.max(1, Math.min(remainingCount, 8));
  }

  return account.debtType === "Credit Card" ? 3 : 4;
}

function getDifferenceInDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function getScheduleDatesWithinWindow(
  scheduleItems: DebtScheduleItem[],
  startDate: Date,
  endDate: Date,
): Array<DebtScheduleItem & { date: Date }> {
  return scheduleItems
    .filter((item) => item.status !== "Paid")
    .map((item) => {
      const date = getDateOnly(item.dueDate);
      return date ? { ...item, date } : null;
    })
    .filter((item): item is DebtScheduleItem & { date: Date } => item !== null)
    .filter((item) => item.date >= startDate && item.date <= endDate)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

function sumScheduleAmounts(items: Array<{ amount: number }>): number {
  return normalizeAmount(items.reduce((sum, item) => sum + item.amount, 0));
}

function buildTimingClusterFromEntries(
  entries: Array<{ dueDate: string; amount: number }>,
): DebtTimingCluster | undefined {
  const today = getToday();
  const horizon = addDays(today, DEBT_FORWARD_WINDOW_DAYS);
  const datedEntries = entries
    .map((entry) => {
      const date = getDateOnly(entry.dueDate);
      return date ? { ...entry, date } : null;
    })
    .filter((entry): entry is { dueDate: string; amount: number; date: Date } => entry !== null)
    .filter((entry) => entry.date >= today && entry.date <= horizon)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));

  if (datedEntries.length < 2) {
    return undefined;
  }

  let bestCluster: Array<{ dueDate: string; amount: number; date: Date }> = [];
  let currentCluster: Array<{ dueDate: string; amount: number; date: Date }> = [];

  for (const entry of datedEntries) {
    if (currentCluster.length === 0) {
      currentCluster = [entry];
      continue;
    }

    const previous = currentCluster[currentCluster.length - 1];
    if (
      getDifferenceInDays(previous.date, entry.date) <= DEBT_POLICY.timingClusterGapDays
    ) {
      currentCluster.push(entry);
      continue;
    }

    if (
      currentCluster.length > bestCluster.length ||
      (currentCluster.length === bestCluster.length &&
        sumScheduleAmounts(currentCluster) > sumScheduleAmounts(bestCluster))
    ) {
      bestCluster = currentCluster;
    }

    currentCluster = [entry];
  }

  if (
    currentCluster.length > bestCluster.length ||
    (currentCluster.length === bestCluster.length &&
      sumScheduleAmounts(currentCluster) > sumScheduleAmounts(bestCluster))
  ) {
    bestCluster = currentCluster;
  }

  if (bestCluster.length < 2) {
    return undefined;
  }

  const startDate = bestCluster[0].dueDate;
  const endDate = bestCluster[bestCluster.length - 1].dueDate;
  const totalAmount = sumScheduleAmounts(bestCluster);

  return {
    count: bestCluster.length,
    startDate,
    endDate,
    totalAmount,
    note: `${bestCluster.length} required payment${bestCluster.length === 1 ? "" : "s"} land between ${formatDate(
      startDate,
    )} and ${formatDate(endDate)} totaling ${formatCurrency(totalAmount)}.`,
  };
}

function getPastDueCatchUpAmount(
  account: DebtAccount,
  scheduleItems: DebtScheduleItem[],
): number {
  const today = getToday();
  const pastDueScheduledTotal = sumScheduleAmounts(
    getScheduleDatesWithinWindow(scheduleItems, new Date(2000, 0, 1), addDays(today, -1)),
  );
  return normalizeAmount(Math.max(account.pastDueAmount ?? 0, pastDueScheduledTotal));
}

function getBoundedOperationalScheduleEntries(
  scheduleItems: DebtScheduleItem[],
): Array<DebtScheduleItem & { date: Date }> {
  const today = getToday();
  const horizon = addDays(today, DEBT_OPERATIONAL_WINDOW_DAYS);

  return scheduleItems
    .filter((item) => item.status !== "Paid")
    .map((item) => {
      const date = getDateOnly(item.dueDate);
      return date ? { ...item, date } : null;
    })
    .filter((item): item is DebtScheduleItem & { date: Date } => item !== null)
    .filter((item) => item.date >= today && item.date <= horizon)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

function getDebtLifecyclePolicy(account: DebtAccount): DebtLifecyclePolicy {
  const hasHardshipOverlay = account.arrangementOverlays?.some(
    (overlay) => overlay.type === "hardship_active",
  );
  const hasTemporarySkipOverlay = account.arrangementOverlays?.some(
    (overlay) => overlay.type === "temporary_skip_approved",
  );

  return {
    ...DEBT_LIFECYCLE_POLICY_DEFAULTS,
    hardshipPausesStandingProgression: hasHardshipOverlay
      ? true
      : DEBT_LIFECYCLE_POLICY_DEFAULTS.hardshipPausesStandingProgression,
    temporarySkipPausesStandingProgression: hasTemporarySkipOverlay
      ? true
      : DEBT_LIFECYCLE_POLICY_DEFAULTS.temporarySkipPausesStandingProgression,
  };
}

function getSourceQualityWeight(sourceQuality: DebtSourceQuality): number {
  switch (sourceQuality) {
    case "lender_confirmed":
      return 5;
    case "manual_confirmed":
      return 4;
    case "user_entered":
      return 3;
    case "system_derived":
      return 2;
    case "estimated_default":
    default:
      return 1;
  }
}

function formatSourceQualityLabel(sourceQuality: DebtSourceQuality): string {
  return sourceQuality.replaceAll("_", " ");
}

function buildDefaultTermVersion(account: DebtAccount): DebtTermVersion {
  return {
    id: `${account.id}-term-default`,
    effectiveDate: account.startDate ?? account.nextDueDate ?? toDateOnlyString(getToday()),
    sourceQuality: account.lastVerifiedAgainstStatement ? "manual_confirmed" : "user_entered",
    apr: account.apr,
    rateStructure: account.rateStructure,
    minimumPayment: account.minimumPayment,
    scheduledPaymentAmount: account.scheduledPaymentAmount,
    minimumPaymentMode: account.minimumPaymentMode,
    minimumPaymentPresetId: account.minimumPaymentPresetId,
    paymentAssumptionMode: account.paymentAssumptionMode,
    paymentAssumptionCustomAmount: account.paymentAssumptionCustomAmount,
    gracePeriodStatus: account.gracePeriodStatus,
    promoType: account.promoType,
    promoEndDate: account.promoEndDate,
    termLengthMonths: account.termLengthMonths,
    notes: "Derived from the current saved debt object.",
  };
}

function getDebtTermVersions(account: DebtAccount): DebtTermVersion[] {
  const versions = account.termVersions?.length
    ? account.termVersions.slice()
    : [buildDefaultTermVersion(account)];

  return versions.sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
}

function getEffectiveTermVersionAtDate(
  account: DebtAccount,
  date: Date,
): DebtTermVersion | undefined {
  const dateKey = toDateOnlyString(date);
  const versions = getDebtTermVersions(account).filter(
    (version) => version.effectiveDate <= dateKey,
  );

  return versions.length > 0 ? versions[versions.length - 1] : getDebtTermVersions(account)[0];
}

function buildSeededArrangementOverlays(account: DebtAccount): DebtArrangementOverlay[] {
  const overlays = account.arrangementOverlays?.slice() ?? [];

  if (
    account.lifecycleState === "Deferment" &&
    !overlays.some((overlay) => overlay.type === "deferment" && overlay.status === "active")
  ) {
    overlays.push({
      id: `${account.id}-overlay-deferment`,
      type: "deferment",
      startDate: account.startDate ?? account.nextDueDate ?? toDateOnlyString(getToday()),
      status: "active",
      sourceQuality: "system_derived",
      interestAccrues: account.interestAccrual === "Interest Accruing",
      pauseStandingProgression: true,
      notes: "Derived from the legacy Debt lifecycle state.",
    });
  }

  return overlays.sort((left, right) => left.startDate.localeCompare(right.startDate));
}

function isOverlayActiveOnDate(
  overlay: DebtArrangementOverlay,
  date: Date,
): boolean {
  if (overlay.status !== "active") {
    return false;
  }

  const start = getDateOnly(overlay.startDate);
  const end = overlay.endDate ? getDateOnly(overlay.endDate) : null;
  if (!start) {
    return false;
  }

  return start <= date && (!end || end >= date);
}

function buildBillDerivedLifecycleEvents(
  account: DebtAccount,
  bills: Bill[],
): DebtLifecycleEvent[] {
  return bills
    .filter((bill) => bill.sourceDebtAccountId === account.id)
    .flatMap((bill) => {
      const events: DebtLifecycleEvent[] = [];
      const dueAmount = getBillTotalAmount(bill);
      const paidAmount =
        typeof bill.paidAmount === "number" ? normalizeAmount(bill.paidAmount) : 0;

      if (bill.status === "Paid" || paidAmount > 0) {
        events.push({
          id: `${account.id}-${bill.id}-${paidAmount > 0 && paidAmount < dueAmount ? "partial" : "paid"}`,
          eventType:
            paidAmount > 0 && paidAmount < dueAmount
              ? "partial_payment_posted"
              : "payment_posted",
          effectiveDate: bill.paidDate ?? bill.dueDate,
          recordedDate: bill.paidDate ?? bill.dueDate,
          source: "Bills",
          sourceQuality: "system_derived",
          reversible: true,
          relatedBillId: bill.id,
          amount: paidAmount > 0 ? paidAmount : dueAmount,
          note:
            paidAmount > 0 && paidAmount < dueAmount
              ? `Partial debt payment of ${formatCurrency(paidAmount)} was recorded in Bills.`
              : `Debt payment of ${formatCurrency(paidAmount > 0 ? paidAmount : dueAmount)} was recorded in Bills.`,
        });
      }

      if ((bill.lateFeeAmount ?? 0) > 0) {
        events.push({
          id: `${account.id}-${bill.id}-late-fee`,
          eventType: "late_fee_applied",
          effectiveDate: bill.dueDate,
          source: "Bills",
          sourceQuality: "system_derived",
          reversible: true,
          relatedBillId: bill.id,
          amount: normalizeAmount(bill.lateFeeAmount ?? 0),
          note: `Late fee of ${formatCurrency(bill.lateFeeAmount ?? 0)} is attached to the debt-linked bill.`,
        });
      }

      return events;
    });
}

function buildLifecycleEventSignature(event: DebtLifecycleEvent): string {
  return [
    event.eventType,
    event.effectiveDate,
    event.recordedDate ?? "",
    event.relatedBillId ?? "",
    event.amount ?? "",
    event.standingState ?? "",
    event.arrangementType ?? "",
    event.continuityEventType ?? "",
    event.note ?? "",
  ].join("|");
}

function normalizeLifecycleEvents(
  account: DebtAccount,
  bills: Bill[],
): {
  events: DebtLifecycleEvent[];
  duplicateSuppressedCount: number;
} {
  const seededEvents = [...buildBillDerivedLifecycleEvents(account, bills), ...(account.lifecycleEvents ?? [])]
    .filter((event) => isValidDateOnly(event.effectiveDate))
    .sort((left, right) => {
      const dateCompare = left.effectiveDate.localeCompare(right.effectiveDate);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return getSourceQualityWeight(right.sourceQuality) - getSourceQualityWeight(left.sourceQuality);
    });

  const seen = new Set<string>();
  const events: DebtLifecycleEvent[] = [];
  let duplicateSuppressedCount = 0;

  for (const event of seededEvents) {
    if (event.correctedEventId) {
      continue;
    }

    const signature = buildLifecycleEventSignature(event);
    if (seen.has(signature)) {
      duplicateSuppressedCount += 1;
      continue;
    }

    seen.add(signature);
    events.push(event);
  }

  return {
    events,
    duplicateSuppressedCount,
  };
}

function getReversedAmountForBill(events: DebtLifecycleEvent[], billId: string): number {
  return normalizeAmount(
    events
      .filter(
        (event) =>
          event.relatedBillId === billId &&
          (event.eventType === "payment_reversed" || event.eventType === "payment_failed"),
      )
      .reduce((sum, event) => sum + normalizeAmount(event.amount ?? 0), 0),
  );
}

function buildLifecycleConflicts(input: {
  account: DebtAccount;
  bills: Bill[];
  events: DebtLifecycleEvent[];
  activeOverlays: DebtArrangementOverlay[];
  duplicateSuppressedCount: number;
}): DebtSourceConflict[] {
  const { account, bills, events, activeOverlays, duplicateSuppressedCount } = input;
  const conflicts: DebtSourceConflict[] = [...(account.sourceConflicts ?? [])];

  if (duplicateSuppressedCount > 0) {
    conflicts.push({
      id: `${account.id}-conflict-duplicate-events`,
      type: "duplicate-event-conflict",
      summary: "Duplicate lifecycle events were suppressed",
      detail: `${duplicateSuppressedCount} duplicate or replayed event${duplicateSuppressedCount === 1 ? "" : "s"} were ignored so lifecycle history stays stable.`,
      severity: "warning",
      requiresConfirmation: false,
    });
  }

  const reversedPaidBills = bills.filter((bill) => {
    if (bill.sourceDebtAccountId !== account.id) {
      return false;
    }

    return getReversedAmountForBill(events, bill.id) > 0 && (bill.status === "Paid" || (bill.paidAmount ?? 0) > 0);
  });

  for (const bill of reversedPaidBills) {
    conflicts.push({
      id: `${account.id}-${bill.id}-payment-conflict`,
      type: "payment-status-conflict",
      summary: "Bills shows a completed payment that Debt also sees as reversed or failed",
      detail: `${bill.name} is marked completed in Bills, but a failed or reversed payment event exists in Debt lifecycle history.`,
      severity: "critical",
      requiresConfirmation: true,
    });
  }

  if (
    activeOverlays.some((overlay) => overlay.type === "hardship_active") &&
    activeOverlays.every((overlay) => overlay.type !== "hardship_active" || overlay.pauseStandingProgression !== true)
  ) {
    conflicts.push({
      id: `${account.id}-hardship-pause-conflict`,
      type: "arrangement-rule-conflict",
      summary: "Hardship overlay is active without an explicit standing pause rule",
      detail: "Debt can show hardship cleanly, but the standing-progression pause behavior is not explicitly confirmed.",
      severity: "warning",
      requiresConfirmation: true,
    });
  }

  if (
    account.continuity?.successorAccountId &&
    typeof account.continuity.transferredAmount === "number" &&
    account.currentBalance > 0 &&
    normalizeAmount(account.continuity.transferredAmount) !== normalizeAmount(account.currentBalance)
  ) {
    conflicts.push({
      id: `${account.id}-continuity-balance-conflict`,
      type: "continuity-balance-conflict",
      summary: "Transferred amount does not match the current predecessor balance",
      detail: `The continuity chain records ${formatCurrency(account.continuity.transferredAmount)} transferred, while the predecessor still shows ${formatCurrency(account.currentBalance)}.`,
      severity: "warning",
      requiresConfirmation: true,
    });
  }

  return conflicts;
}

function getLifecycleCureSnapshot(
  account: DebtAccount,
  bills: Bill[],
  events: DebtLifecycleEvent[],
  policy: DebtLifecyclePolicy,
): {
  requiredAmountDue: number;
  partialPaymentReceived: number;
  unpaidAmountAfterPartial: number;
  amountNeededToCure: number;
  daysPastDue: number;
  earliestUnresolvedDueDate?: string;
} {
  const today = getToday();
  const relevantBills = bills.filter((bill) => {
    if (bill.sourceDebtAccountId !== account.id) {
      return false;
    }

    const dueDate = getDateOnly(bill.dueDate);
    return Boolean(dueDate && dueDate <= today);
  });

  const billTotals = relevantBills.map((bill) => {
    const dueAmount = policy.lateFeesCountTowardCure ? getBillTotalAmount(bill) : normalizeAmount(bill.amount);
    const paidAmount =
      typeof bill.paidAmount === "number"
        ? normalizeAmount(bill.paidAmount)
        : bill.status === "Paid"
          ? dueAmount
          : 0;
    const reversedAmount = getReversedAmountForBill(events, bill.id);
    const netPayment = Math.max(0, normalizeAmount(paidAmount - reversedAmount));

    return {
      bill,
      dueAmount,
      netPayment,
    };
  });

  const requiredAmountDue = normalizeAmount(
    billTotals.reduce((sum, entry) => sum + entry.dueAmount, 0),
  );
  const partialPaymentReceived = normalizeAmount(
    billTotals.reduce((sum, entry) => sum + Math.min(entry.dueAmount, entry.netPayment), 0),
  );
  const unresolvedAmountFromBills = normalizeAmount(
    Math.max(0, requiredAmountDue - partialPaymentReceived),
  );
  const amountNeededToCure = normalizeAmount(
    Math.max(account.pastDueAmount ?? 0, unresolvedAmountFromBills),
  );
  const earliestUnresolvedDueDate = billTotals
    .filter((entry) => entry.netPayment < entry.dueAmount)
    .map((entry) => entry.bill.dueDate)
    .sort()[0];

  const daysPastDue =
    typeof account.daysPastDue === "number"
      ? account.daysPastDue
      : earliestUnresolvedDueDate
        ? Math.max(0, getDifferenceInDays(getDateOnly(earliestUnresolvedDueDate)!, today))
        : 0;

  return {
    requiredAmountDue,
    partialPaymentReceived,
    unpaidAmountAfterPartial: unresolvedAmountFromBills,
    amountNeededToCure,
    daysPastDue,
    earliestUnresolvedDueDate,
  };
}

function resolveStandingState(input: {
  account: DebtAccount;
  amountNeededToCure: number;
  daysPastDue: number;
  activeOverlays: DebtArrangementOverlay[];
  events: DebtLifecycleEvent[];
  policy: DebtLifecyclePolicy;
  earliestUnresolvedDueDate?: string;
}): {
  standingState: DebtStandingState;
  explanation: string;
  nextEscalationDate?: string;
} {
  const { account, amountNeededToCure, daysPastDue, activeOverlays, events, policy, earliestUnresolvedDueDate } = input;
  const latestStandingEvent = [...events]
    .reverse()
    .find((event) => event.eventType === "standing_state_changed" && event.standingState);
  const hasCollectionsEvent = events.some((event) => event.eventType === "collections_confirmed");
  const hasResolvedEvent = events.some(
    (event) => event.eventType === "settlement_completed" || event.eventType === "account_resolved",
  );
  const hasAccountClosedEvent = events.some((event) => event.eventType === "account_closed");
  const standingPaused = activeOverlays.some((overlay) => {
    if (overlay.type === "hardship_active") {
      return overlay.pauseStandingProgression ?? policy.hardshipPausesStandingProgression;
    }

    if (overlay.type === "temporary_skip_approved") {
      return overlay.pauseStandingProgression ?? policy.temporarySkipPausesStandingProgression;
    }

    return overlay.pauseStandingProgression === true;
  });

  if (account.currentBalance <= 0) {
    return {
      standingState: hasResolvedEvent ? "resolved" : "paid_off",
      explanation: hasResolvedEvent
        ? "Lifecycle history records this obligation as resolved."
        : "Current balance is zero, so the obligation is treated as paid off.",
    };
  }

  if (hasResolvedEvent) {
    return {
      standingState: "resolved",
      explanation: "A settlement-completed or account-resolved lifecycle event is active.",
    };
  }

  if (hasCollectionsEvent) {
    return {
      standingState: "collections",
      explanation: "Collections is manually or operationally confirmed in lifecycle history.",
    };
  }

  if (latestStandingEvent?.standingState === "charged_off") {
    return {
      standingState: "charged_off",
      explanation: "Lifecycle history explicitly records the account as charged off.",
    };
  }

  if (
    account.lifecycleState === "Closed With Balance" ||
    hasAccountClosedEvent ||
    latestStandingEvent?.standingState === "closed_with_balance"
  ) {
    return {
      standingState: "closed_with_balance",
      explanation: "The account is closed, but a balance still remains on the obligation.",
    };
  }

  if (standingPaused && amountNeededToCure > 0) {
    return {
      standingState: "current",
      explanation: "An active arrangement overlay is pausing standing deterioration even though unpaid pressure still exists.",
    };
  }

  if (amountNeededToCure > 0) {
    if (daysPastDue >= policy.delinquencyThresholdDays || account.isDelinquent) {
      return {
        standingState: "delinquent",
        explanation: `${daysPastDue} days past due exceeds the configured delinquency threshold.`,
      };
    }

    if (daysPastDue > policy.graceWindowDays) {
      return {
        standingState: "late",
        explanation: "The account remains unpaid beyond the grace window.",
        nextEscalationDate: earliestUnresolvedDueDate
          ? toDateOnlyString(
              addDays(getDateOnly(earliestUnresolvedDueDate)!, policy.delinquencyThresholdDays),
            )
          : undefined,
      };
    }

    if (daysPastDue >= 0) {
      return {
        standingState: "grace_window",
        explanation: "The account is unpaid, but still inside the active grace window.",
        nextEscalationDate: earliestUnresolvedDueDate
          ? toDateOnlyString(
              addDays(getDateOnly(earliestUnresolvedDueDate)!, policy.graceWindowDays),
            )
          : undefined,
      };
    }
  }

  if (
    latestStandingEvent?.standingState === "cured" ||
    events.some((event) => event.eventType === "account_cured")
  ) {
    return {
      standingState: "cured",
      explanation: "Lifecycle history records that the account was cured after prior unpaid pressure.",
    };
  }

  if (latestStandingEvent?.standingState && latestStandingEvent.standingState !== "current") {
    return {
      standingState: latestStandingEvent.standingState,
      explanation: "Debt is honoring the latest explicit standing-state event.",
    };
  }

  return {
    standingState: "current",
    explanation: "The current debt truth does not show unpaid pressure severe enough to move the account out of current standing.",
  };
}

function buildSourceQualitySummary(
  account: DebtAccount,
  events: DebtLifecycleEvent[],
  activeOverlays: DebtArrangementOverlay[],
  effectiveTermVersion: DebtTermVersion | undefined,
): string {
  const qualities = [
    ...events.map((event) => event.sourceQuality),
    ...activeOverlays.map((overlay) => overlay.sourceQuality),
    ...(effectiveTermVersion ? [effectiveTermVersion.sourceQuality] : []),
  ];

  if (qualities.length === 0) {
    return "Lifecycle is currently relying on user-entered debt truth.";
  }

  const strongest = qualities.sort((left, right) => getSourceQualityWeight(right) - getSourceQualityWeight(left))[0];
  return `${formatSourceQualityLabel(strongest)} currently anchors the strongest lifecycle evidence for ${account.providerName}.`;
}

function buildDebtLifecycleSnapshot(
  account: DebtAccount,
  bills: Bill[],
): DebtLifecycleSnapshot {
  const policy = getDebtLifecyclePolicy(account);
  const today = getToday();
  const activeOverlays = buildSeededArrangementOverlays(account).filter((overlay) =>
    isOverlayActiveOnDate(overlay, today),
  );
  const { events, duplicateSuppressedCount } = normalizeLifecycleEvents(account, bills);
  const cure = getLifecycleCureSnapshot(account, bills, events, policy);
  const effectiveTermVersion = getEffectiveTermVersionAtDate(account, today);
  const sourceConflicts = buildLifecycleConflicts({
    account,
    bills,
    events,
    activeOverlays,
    duplicateSuppressedCount,
  });
  const standing = resolveStandingState({
    account,
    amountNeededToCure: cure.amountNeededToCure,
    daysPastDue: cure.daysPastDue,
    activeOverlays,
    events,
    policy,
    earliestUnresolvedDueDate: cure.earliestUnresolvedDueDate,
  });

  return {
    standingState: standing.standingState,
    standingExplanation: standing.explanation,
    daysPastDue: cure.daysPastDue,
    amountNeededToCure: cure.amountNeededToCure,
    requiredAmountDue: cure.requiredAmountDue,
    partialPaymentReceived: cure.partialPaymentReceived,
    unpaidAmountAfterPartial: cure.unpaidAmountAfterPartial,
    nextEscalationDate: standing.nextEscalationDate,
    activeOverlays,
    effectiveTermVersion,
    eventTimeline: events,
    sourceConflicts,
    duplicateSuppressedCount,
    sourceQualitySummary: buildSourceQualitySummary(
      account,
      events,
      activeOverlays,
      effectiveTermVersion,
    ),
    failedPaymentCount: events.filter(
      (event) =>
        event.eventType === "payment_failed" || event.eventType === "payment_reversed",
    ).length,
    severeState:
      standing.standingState === "delinquent" ||
      standing.standingState === "charged_off" ||
      standing.standingState === "collections",
    gracePeriodState: effectiveTermVersion?.gracePeriodStatus ?? account.gracePeriodStatus,
    continuity: account.continuity,
    policy,
  };
}

function buildDebtCashWindows(
  account: DebtAccount,
  scheduleItems: DebtScheduleItem[],
): {
  cashWindows: DebtCashWindow[];
  timingCluster?: DebtTimingCluster;
  pastDueCatchUpAmount: number;
} {
  const today = getToday();
  const futureUnpaidEntries = getScheduleDatesWithinWindow(
    scheduleItems,
    today,
    addDays(today, DEBT_FORWARD_WINDOW_DAYS),
  );
  const pastDueCatchUpAmount = getPastDueCatchUpAmount(account, scheduleItems);
  const timingCluster = buildTimingClusterFromEntries(futureUnpaidEntries);

  const cashWindows: DebtCashWindow[] = DEBT_CASH_WINDOW_DAYS.map((windowDays) => {
    const endDate = addDays(today, windowDays);
    const windowEntries = futureUnpaidEntries.filter((entry) => entry.date <= endDate);
    const requiredPaymentTotal = sumScheduleAmounts(windowEntries);
    const minimumCashNeededToStayCurrent = normalizeAmount(
      requiredPaymentTotal + pastDueCatchUpAmount,
    );
    const activeCluster =
      timingCluster && getDateOnly(timingCluster.endDate)
        ? getDateOnly(timingCluster.endDate)! <= endDate
          ? timingCluster
          : undefined
        : undefined;

    return {
      windowDays,
      requiredPaymentTotal,
      minimumCashNeededToStayCurrent,
      dueCount: windowEntries.length,
      nextDueDate: windowEntries[0]?.dueDate,
      timingPressureNote:
        activeCluster?.note ??
        (windowEntries.length > 1
          ? `${windowEntries.length} required payments fall inside the next ${windowDays} days.`
          : undefined),
    };
  });

  return {
    cashWindows,
    timingCluster,
    pastDueCatchUpAmount,
  };
}

function buildReliabilityIssues(
  account: DebtAccount,
  scheduledAmount: number,
  scheduleItems: DebtScheduleItem[],
): string[] {
  const issues = new Set<string>();

  if (
    account.paymentRequirement === "Payment Required" &&
    account.lifecycleState !== "Deferment" &&
    (!account.nextDueDate || !isValidDateOnly(account.nextDueDate))
  ) {
    issues.add("Next due date is missing.");
  }

  if (account.paymentRequirement === "Payment Required" && scheduledAmount <= 0) {
    issues.add("Required payment amount is missing.");
  }

  if (account.interestAccrual === "Interest Accruing" && (!account.apr || account.apr <= 0)) {
    issues.add("APR is missing while interest is accruing.");
  }

  if (typeof account.promoBalance === "number" && account.promoBalance > 0 && !account.promoEndDate) {
    issues.add("Promo balance is present, but promo end date is missing.");
  }

  if (typeof account.promoBalance === "number" && account.promoBalance > 0 && !account.promoType) {
    issues.add("Promo balance is present, but promo type is missing.");
  }

  if ((account.isDelinquent || (account.pastDueAmount ?? 0) > 0) && !account.daysPastDue) {
    issues.add("Days past due is not recorded.");
  }

  if (
    account.debtType === "Credit Card" &&
    account.currentBalance > 0 &&
    !account.gracePeriodStatus
  ) {
    issues.add("Grace-period status is not recorded.");
  }

  if (
    account.debtType === "Credit Card" &&
    (account.isDelinquent || (account.pastDueAmount ?? 0) > 0) &&
    account.lateFeeAmount === undefined
  ) {
    issues.add("Late-fee detail is not recorded while the account is behind.");
  }

  if (scheduleItems.length === 0 && account.paymentRequirement === "Payment Required") {
    issues.add("No debt-linked schedule rows are available in the current bounded operational window.");
  }

  return [...issues];
}

function buildDebtFactualFlags(input: {
  account: DebtAccount;
  lifecycle: DebtLifecycleSnapshot;
  scheduledAmount: number;
  utilizationPercent?: number;
  timingCluster?: DebtTimingCluster;
  reliabilityIssues: string[];
}): DebtFactualFlag[] {
  const {
    account,
    lifecycle,
    scheduledAmount,
    utilizationPercent,
    timingCluster,
    reliabilityIssues,
  } = input;
  const today = getToday();
  const flags: DebtFactualFlag[] = [];
  const nextDueDate = account.nextDueDate && isValidDateOnly(account.nextDueDate) ? getDateOnly(account.nextDueDate) : null;
  const daysUntilDue = nextDueDate ? getDifferenceInDays(today, nextDueDate) : undefined;
  const promoEndDate = account.promoEndDate && isValidDateOnly(account.promoEndDate) ? getDateOnly(account.promoEndDate) : null;
  const daysUntilPromoEnd = promoEndDate ? getDifferenceInDays(today, promoEndDate) : undefined;
  const noPaymentRequired =
    account.paymentRequirement === "No Payment Required" || account.lifecycleState === "Deferment";
  const behindAmount = normalizeAmount(account.pastDueAmount ?? 0);

  if (account.isDelinquent || (typeof account.daysPastDue === "number" && account.daysPastDue >= 30)) {
    flags.push({
      id: `${account.id}-flag-delinquent`,
      type: "Delinquent",
      label: "Delinquent",
      detail:
        typeof account.daysPastDue === "number"
          ? `${account.daysPastDue} days past due.`
        : "Account is marked delinquent in debt truth.",
    });
  }

  if (lifecycle.standingState === "grace_window") {
    flags.push({
      id: `${account.id}-flag-grace-window`,
      type: "Grace Window",
      label: "Grace Window",
      detail: lifecycle.standingExplanation,
    });
  }

  if (behindAmount > 0 || account.isDelinquent) {
    flags.push({
      id: `${account.id}-flag-behind`,
      type: "Past Due / Behind",
      label: "Past Due / Behind",
      detail:
        behindAmount > 0
          ? `${formatCurrency(behindAmount)} is currently recorded as past due.`
          : "Account is behind based on current debt truth.",
    });
  }

  if (lifecycle.failedPaymentCount > 0) {
    flags.push({
      id: `${account.id}-flag-failed-payment`,
      type: "Failed Payment",
      label: "Failed Payment",
      detail: `${lifecycle.failedPaymentCount} failed or reversed payment event${lifecycle.failedPaymentCount === 1 ? "" : "s"} remain in the lifecycle timeline.`,
    });
  }

  if (
    typeof daysUntilDue === "number" &&
    daysUntilDue >= 0 &&
    daysUntilDue <= DEBT_POLICY.paymentDueSoonDays
  ) {
    flags.push({
      id: `${account.id}-flag-payment-due-soon`,
      type: "Payment Due Soon",
      label: "Payment Due Soon",
      detail:
        scheduledAmount > 0
          ? `${formatCurrency(scheduledAmount)} is due ${formatDate(account.nextDueDate as string)}.`
          : `A due date is set for ${formatDate(account.nextDueDate as string)}.`,
    });
  } else if (
    typeof daysUntilDue === "number" &&
    daysUntilDue > DEBT_POLICY.paymentDueSoonDays &&
    daysUntilDue <= DEBT_POLICY.dueSoonDays
  ) {
    flags.push({
      id: `${account.id}-flag-due-soon`,
      type: "Due Soon",
      label: "Due Soon",
      detail: `Next due date is ${formatDate(account.nextDueDate as string)}.`,
    });
  }

  if (
    typeof daysUntilPromoEnd === "number" &&
    daysUntilPromoEnd >= 0 &&
    daysUntilPromoEnd <= DEBT_POLICY.promoExpiringSoonDays &&
    typeof account.promoBalance === "number" &&
    account.promoBalance > 0
  ) {
    flags.push({
      id: `${account.id}-flag-promo-expiring`,
      type: "Promo Expiring Soon",
      label: "Promo Expiring Soon",
      detail: `${account.promoType ?? "Promo"} balance ends ${formatDate(account.promoEndDate as string)}.`,
    });
  }

  if (
    typeof utilizationPercent === "number" &&
    utilizationPercent >= DEBT_POLICY.highUtilizationThreshold
  ) {
    flags.push({
      id: `${account.id}-flag-utilization`,
      type: "High Utilization",
      label: "High Utilization",
      detail: `${utilizationPercent.toFixed(1)}% of the current credit limit is in use.`,
    });
  }

  if (account.interestAccrual === "Interest Accruing" && account.currentBalance > 0) {
    flags.push({
      id: `${account.id}-flag-interest-accruing`,
      type: "Interest Accruing",
      label: "Interest Accruing",
      detail: "Balance is currently accruing interest.",
    });
  }

  if (noPaymentRequired) {
    flags.push({
      id: `${account.id}-flag-no-payment-required`,
      type: "No Payment Required",
      label: "No Payment Required",
      detail:
        account.lifecycleState === "Deferment"
          ? "Account is in deferment."
          : "Payment is currently not required.",
    });
  }

  if (noPaymentRequired && account.interestAccrual === "Interest Accruing") {
    flags.push({
      id: `${account.id}-flag-interest-no-payment`,
      type: "Interest Accruing While No Payment Required",
      label: "Interest Accruing While No Payment Required",
      detail: "Interest is still accruing even though payment is not currently required.",
    });
  }

  if (account.lifecycleState === "Closed With Balance" && account.currentBalance > 0) {
    flags.push({
      id: `${account.id}-flag-closed-balance`,
      type: "Closed With Balance",
      label: "Closed With Balance",
      detail: `${formatCurrency(account.currentBalance)} remains on a closed account.`,
    });
  }

  if (timingCluster) {
    flags.push({
      id: `${account.id}-flag-timing-cluster`,
      type: "Timing Cluster Forming",
      label: "Timing Cluster Forming",
      detail: timingCluster.note,
    });
  }

  if (lifecycle.activeOverlays.some((overlay) => overlay.type === "hardship_active")) {
    flags.push({
      id: `${account.id}-flag-hardship`,
      type: "Hardship Active",
      label: "Hardship Active",
      detail: "A hardship arrangement is currently active on this account.",
    });
  }

  if (lifecycle.activeOverlays.some((overlay) => overlay.type === "forbearance")) {
    flags.push({
      id: `${account.id}-flag-forbearance`,
      type: "Forbearance Active",
      label: "Forbearance Active",
      detail: "Forbearance is active and may modify how standing should be interpreted.",
    });
  }

  if (lifecycle.standingState === "collections") {
    flags.push({
      id: `${account.id}-flag-collections`,
      type: "Collections Confirmed",
      label: "Collections Confirmed",
      detail: "Collections is explicitly present in lifecycle history or manual confirmation.",
    });
  }

  if (lifecycle.activeOverlays.some((overlay) => overlay.type === "settlement_active")) {
    flags.push({
      id: `${account.id}-flag-settlement`,
      type: "Settlement Active",
      label: "Settlement Active",
      detail: "A settlement workflow is active on this account.",
    });
  }

  if (lifecycle.activeOverlays.some((overlay) => overlay.type === "dispute_active")) {
    flags.push({
      id: `${account.id}-flag-dispute`,
      type: "Dispute Active",
      label: "Dispute Active",
      detail: "A dispute overlay is active and remains distinct from primary standing state.",
    });
  }

  if (account.rateStructure === "Adjustable" || account.rateStructure === "Variable") {
    flags.push({
      id: `${account.id}-flag-variable-rate`,
      type: "Variable Rate Risk",
      label: "Variable Rate Risk",
      detail: `${account.rateStructure} rate behavior is recorded, so future interest cost may change as terms change.`,
    });
  }

  if (account.isSecured || account.debtType === "Mortgage" || account.debtType === "Auto Loan") {
    flags.push({
      id: `${account.id}-flag-secured`,
      type: "Secured Debt Exposure",
      label: "Secured Debt Exposure",
      detail: "This obligation is secured or collateral-linked, so missed-payment pressure can expose an attached asset.",
    });
  }

  if (account.debtType === "BNPL" && timingCluster) {
    flags.push({
      id: `${account.id}-flag-bnpl-stacking`,
      type: "BNPL Stacking Risk",
      label: "BNPL Stacking Risk",
      detail: "Multiple short-term installment payments are clustering close together in the current bounded window.",
    });
  }

  if (account.deferredInterestApplies) {
    flags.push({
      id: `${account.id}-flag-deferred-interest`,
      type: "Deferred Interest Risk",
      label: "Deferred Interest Risk",
      detail: "Deferred-interest treatment is recorded for this account, so promo handling can sharply change future cost.",
    });
  }

  if (account.drawPeriodEndDate) {
    const drawPeriodEnd = getDateOnly(account.drawPeriodEndDate);
    const daysUntilDrawPeriodEnd =
      drawPeriodEnd ? getDifferenceInDays(today, drawPeriodEnd) : undefined;

    if (
      typeof daysUntilDrawPeriodEnd === "number" &&
      daysUntilDrawPeriodEnd >= 0 &&
      daysUntilDrawPeriodEnd <= 60
    ) {
      flags.push({
        id: `${account.id}-flag-draw-period`,
        type: "Draw Period Ending",
        label: "Draw Period Ending",
        detail: `The draw period currently ends ${formatDate(account.drawPeriodEndDate)}.`,
      });
    }
  }

  if (
    account.debtType === "Auto Loan" &&
    typeof account.vehicleValue === "number" &&
    account.vehicleValue > 0 &&
    account.currentBalance > account.vehicleValue
  ) {
    flags.push({
      id: `${account.id}-flag-negative-equity`,
      type: "Negative Equity",
      label: "Negative Equity",
      detail: `${formatCurrency(account.currentBalance - account.vehicleValue)} more is owed than the recorded vehicle value.`,
    });
  }

  if (
    typeof account.capitalizedInterestTotal === "number" &&
    account.capitalizedInterestTotal > 0
  ) {
    flags.push({
      id: `${account.id}-flag-capitalized-interest`,
      type: "Interest Capitalized",
      label: "Interest Capitalized",
      detail: `${formatCurrency(account.capitalizedInterestTotal)} has already been capitalized into principal.`,
    });
  }

  if (lifecycle.sourceConflicts.length > 0) {
    flags.push({
      id: `${account.id}-flag-source-conflict`,
      type: "Source Conflict Present",
      label: "Source Conflict Present",
      detail: `${lifecycle.sourceConflicts.length} lifecycle conflict${lifecycle.sourceConflicts.length === 1 ? "" : "s"} still need confirmation or cleanup.`,
    });
  }

  if (reliabilityIssues.length > 0) {
    flags.push({
      id: `${account.id}-flag-missing-inputs`,
      type: "Missing Key Inputs Limiting Reliability",
      label: "Missing Key Inputs Limiting Reliability",
      detail: reliabilityIssues.join(" "),
    });
  }

  return flags;
}

function buildDebtConsequences(input: {
  account: DebtAccount;
  lifecycle: DebtLifecycleSnapshot;
  estimatedMonthlyInterest?: number;
  pastDueCatchUpAmount: number;
}): DebtConsequenceItem[] {
  const { account, lifecycle, estimatedMonthlyInterest, pastDueCatchUpAmount } = input;
  const items: DebtConsequenceItem[] = [];

  if (typeof account.lateFeeAmount === "number" && account.lateFeeAmount > 0) {
    items.push({
      id: `${account.id}-consequence-late-fee`,
      type: "Late Fee Exposure",
      label: "Late Fee Exposure",
      detail: `${formatCurrency(account.lateFeeAmount)} in late fees is already applied to this account.`,
    });
  }

  if (
    typeof account.promoBalance === "number" &&
    account.promoBalance > 0 &&
    account.promoEndDate &&
    isValidDateOnly(account.promoEndDate)
  ) {
    items.push({
      id: `${account.id}-consequence-promo`,
      type: "Promo Expiration Risk",
      label: "Promo Expiration Risk",
      detail: `${formatCurrency(account.promoBalance)} under ${account.promoType ?? "promo"} terms reaches its recorded end date on ${formatDate(account.promoEndDate)}.`,
    });
  }

  if (account.gracePeriodStatus === "Grace Period Lost") {
    items.push({
      id: `${account.id}-consequence-grace`,
      type: "Loss of Grace Period",
      label: "Loss of Grace Period",
      detail: "Grace-period loss is recorded for this account, so revolving balance costs can start immediately.",
    });
  }

  if (
    account.interestAccrual === "Interest Accruing" &&
    typeof estimatedMonthlyInterest === "number" &&
    estimatedMonthlyInterest > 0
  ) {
    items.push({
      id: `${account.id}-consequence-interest`,
      type: "Increased Interest Burden",
      label: "Increased Interest Burden",
      detail: `At the current balance, interest is adding about ${formatCurrency(estimatedMonthlyInterest)} per month under a stable-APR assumption.`,
    });
  }

  if (account.lifecycleState === "Closed With Balance" && account.currentBalance > 0) {
    items.push({
      id: `${account.id}-consequence-closed-balance`,
      type: "Closed Account Balance Still Owed",
      label: "Closed Account Balance Still Owed",
      detail: `${formatCurrency(account.currentBalance)} is still owed even though the account is marked closed.`,
    });
  }

  if (typeof account.daysPastDue === "number" && account.daysPastDue > 0) {
    items.push({
      id: `${account.id}-consequence-delinquency`,
      type: "Delinquency Progression",
      label: "Delinquency Progression",
      detail: `${account.daysPastDue} days past due is currently recorded on this account.`,
    });
  } else if (pastDueCatchUpAmount > 0 || account.isDelinquent) {
    items.push({
      id: `${account.id}-consequence-delinquency`,
      type: "Delinquency Progression",
      label: "Delinquency Progression",
      detail:
        pastDueCatchUpAmount > 0
          ? `${formatCurrency(pastDueCatchUpAmount)} is recorded as currently behind.`
          : "This account is marked delinquent, but days-past-due detail is not recorded yet.",
    });
  }

  if (lifecycle.standingState === "collections" || lifecycle.standingState === "charged_off") {
    items.push({
      id: `${account.id}-consequence-collections`,
      type: "Collections Progression",
      label: "Collections Progression",
      detail: "This account is already in a severe downstream state, so the lifecycle engine is preserving collections or charge-off visibility directly.",
    });
  }

  if (lifecycle.activeOverlays.some((overlay) => overlay.type === "settlement_active")) {
    items.push({
      id: `${account.id}-consequence-settlement`,
      type: "Settlement Accounting",
      label: "Settlement Accounting",
      detail: "Settlement handling is active, so remaining balance, forgiven amount, and resolution history need to stay inspectable.",
    });
  }

  if (
    (account.isSecured || account.debtType === "Mortgage" || account.debtType === "Auto Loan") &&
    lifecycle.amountNeededToCure > 0
  ) {
    items.push({
      id: `${account.id}-consequence-collateral`,
      type: "Collateral Risk",
      label: "Collateral Risk",
      detail: "Because this is secured or asset-linked debt, unresolved cure pressure can expose the attached collateral.",
    });
  }

  if (account.rateStructure === "Adjustable" || account.rateStructure === "Variable") {
    items.push({
      id: `${account.id}-consequence-variable-rate`,
      type: "Variable Rate Exposure",
      label: "Variable Rate Exposure",
      detail: `${account.rateStructure} rate terms can change future carrying cost beyond the current stable-rate assumption.`,
    });
  }

  if (
    typeof account.capitalizedInterestTotal === "number" &&
    account.capitalizedInterestTotal > 0
  ) {
    items.push({
      id: `${account.id}-consequence-capitalization`,
      type: "Capitalization Growth",
      label: "Capitalization Growth",
      detail: `${formatCurrency(account.capitalizedInterestTotal)} of accrued interest has been rolled into principal, raising future cost on the new balance base.`,
    });
  }

  if (lifecycle.failedPaymentCount > 0) {
    items.push({
      id: `${account.id}-consequence-failed-payment`,
      type: "Failed Payment Exposure",
      label: "Failed Payment Exposure",
      detail: `${lifecycle.failedPaymentCount} failed or reversed payment event${lifecycle.failedPaymentCount === 1 ? "" : "s"} mean the obligation was not actually satisfied.`,
    });
  }

  return items;
}

type DebtProjectionComputation = {
  payoffDate: string;
  totalInterest: number;
  periodCount: number;
};

function buildProjectionInputs(
  account: DebtAccount,
  scheduledAmount: number,
  paymentAmountTrustState: DebtMathTrustState,
): DebtMathInspectableItem[] {
  const interestModelTrustState = getInterestModelTrustState(account);
  const effectiveTermVersion = getEffectiveTermVersionAtDate(account, getToday());
  const currentEffectiveApr =
    typeof effectiveTermVersion?.apr === "number" ? effectiveTermVersion.apr : account.apr;
  const inputs: DebtMathInspectableItem[] = [
    {
      label: "Current balance",
      value: formatCurrency(account.currentBalance),
      state: "Manual",
      note: "Entered directly in Debt account truth.",
    },
    {
      label: "Next due date",
      value: account.nextDueDate ? account.nextDueDate : "Missing",
      state: account.nextDueDate ? "Manual" : "Limited",
      note: account.nextDueDate ? undefined : "A valid next due date is required for date-based payoff projections.",
    },
    {
      label: "Payment cadence",
      value: account.paymentCadence,
      state: "Manual",
      note: "Cadence controls how payoff dates are stepped forward.",
    },
    {
      label: "Payment amount used",
      value: scheduledAmount > 0 ? formatCurrency(scheduledAmount) : "Missing",
      state: paymentAmountTrustState,
      note:
        paymentAmountTrustState === "Custom"
          ? "Using the custom scheduled payment instead of the minimum payment."
          : paymentAmountTrustState === "Exact"
            ? "Using a fixed installment payment supported by the current installment structure."
            : paymentAmountTrustState === "Estimated"
              ? "Using a recurring payment amount inferred from the entered debt structure or fallback payment detail."
          : paymentAmountTrustState === "Manual"
            ? "Using the manually entered recurring payment amount without full amortization support."
            : "A recurring payment amount is required for payoff projection.",
    },
    {
      label: "Interest setting",
      value:
        account.interestAccrual === "No Interest Accruing"
          ? "No interest accruing"
          : typeof currentEffectiveApr === "number" && currentEffectiveApr > 0
            ? `${normalizeAmount(currentEffectiveApr).toFixed(2)}% APR`
            : "APR missing",
      state: interestModelTrustState,
      note:
        account.interestAccrual === "No Interest Accruing"
          ? "Projection uses a zero-interest payoff path."
          : typeof currentEffectiveApr === "number" && currentEffectiveApr > 0
            ? account.debtType === "Credit Card"
              ? "APR is available, but credit-card payoff math remains trust-limited because revolving balances and future statement changes are not simulated."
              : effectiveTermVersion
                ? "Projection uses the current effective term version and steps into later versions as they become active."
                : "APR is treated as stable for the projection."
            : "Interest is accruing, but APR is missing, so interest-aware payoff math is limited.",
    },
  ];

  if (
    typeof account.totalPaymentCount === "number" &&
    typeof account.completedPaymentCount === "number"
  ) {
    inputs.push({
      label: "Installment count source",
      value: `${account.completedPaymentCount} of ${account.totalPaymentCount} completed`,
      state: "Manual",
      note: "Used for installment progress and exact remaining-count reporting.",
    });
  }

  return inputs;
}

function buildProjectionAssumptions(
  account: DebtAccount,
  paymentAmountTrustState: DebtMathTrustState,
): DebtMathInspectableItem[] {
  const assumptions: DebtMathInspectableItem[] = [
    {
      label: "Payment stays constant",
      value:
        paymentAmountTrustState === "Custom"
          ? "Custom payment amount stays fixed"
          : paymentAmountTrustState === "Exact"
            ? "Fixed installment amount stays constant"
          : "Entered payment amount stays fixed",
      state:
        paymentAmountTrustState === "Custom"
          ? "Custom"
          : paymentAmountTrustState === "Exact"
            ? "Exact"
            : paymentAmountTrustState === "Manual"
              ? "Manual"
              : "Estimated",
      note: "Projection assumes the recurring payment amount does not change between due dates.",
    },
  ];

  if (account.interestAccrual === "No Interest Accruing") {
    assumptions.push({
      label: "Interest model",
      value: "No additional interest accrues",
      state: "Exact",
      note: "Payoff and interest projections are exact under the current no-interest setting.",
    });
  } else if (typeof account.apr === "number" && account.apr > 0) {
    assumptions.push({
      label: "Interest model",
      value: `${normalizeAmount(account.apr).toFixed(2)}% APR remains stable`,
      state: account.debtType === "Credit Card" ? "Limited" : "Estimated",
      note:
        account.debtType === "Credit Card"
          ? "Credit-card projections use the active payment assumption, but future statement changes and minimum-rule changes are not simulated."
          : "Interest is projected using a stable APR over the remaining balance.",
    });
  } else {
    assumptions.push({
      label: "Interest model",
      value: "APR missing while interest accrues",
      state: "Limited",
      note: "Projection cannot estimate remaining interest without APR.",
    });
  }

  assumptions.push({
    label: "Behavior stays static",
    value:
      account.debtType === "Credit Card"
        ? "No new charges, minimum-rule changes, or promo changes are modeled"
        : "No skipped payments, rate changes, or behavior changes are modeled",
    state: account.debtType === "Credit Card" ? "Limited" : "Estimated",
    note: "This is a static projection. It does not simulate future behavior changes.",
  });

  if ((account.termVersions?.length ?? 0) > 1) {
    assumptions.push({
      label: "Effective-dated terms",
      value: `${account.termVersions?.length ?? 0} term versions are stored`,
      state: "Manual",
      note: "Projection switches APR or payment terms when a saved term version becomes effective.",
    });
  }

  return assumptions;
}

function simulatePayoffProjection(
  account: DebtAccount,
  startingDate: Date,
  paymentAmount: number,
): DebtProjectionComputation | null {
  if (paymentAmount <= 0 || account.currentBalance <= 0) {
    return null;
  }

  if (
    account.interestAccrual === "Interest Accruing" &&
    (typeof account.apr !== "number" || account.apr <= 0)
  ) {
    return null;
  }

  const periodsPerYear = getPeriodsPerYear(account.paymentCadence);

  let cursor = new Date(startingDate);
  let remainingBalance = normalizeAmount(account.currentBalance);
  let totalInterest = 0;
  let periodCount = 0;

  while (remainingBalance > 0.005 && periodCount < MAX_PROJECTION_PERIODS) {
    const activeTermVersion = getEffectiveTermVersionAtDate(account, cursor);
    const effectiveApr =
      typeof activeTermVersion?.apr === "number" ? activeTermVersion.apr : account.apr;
    const periodRate =
      account.interestAccrual === "Interest Accruing" &&
      typeof effectiveApr === "number" &&
      effectiveApr > 0
        ? effectiveApr / 100 / periodsPerYear
        : 0;

    if (periodRate > 0 && normalizeAmount(remainingBalance * periodRate) >= paymentAmount) {
      return null;
    }

    const interest = normalizeAmount(remainingBalance * periodRate);
    totalInterest = normalizeAmount(totalInterest + interest);
    remainingBalance = normalizeAmount(remainingBalance + interest - paymentAmount);
    periodCount += 1;

    if (remainingBalance <= 0.005) {
      return {
        payoffDate: toDateOnlyString(cursor),
        totalInterest,
        periodCount,
      };
    }

    cursor = addCadence(cursor, account.paymentCadence);
  }

  return null;
}

function buildCountBasedPayoffDate(account: DebtAccount, remainingCount: number): string | undefined {
  if (!account.nextDueDate || remainingCount <= 0) {
    return undefined;
  }

  let cursor = getDateOnly(account.nextDueDate);
  if (!cursor) {
    return undefined;
  }

  for (let index = 1; index < remainingCount; index += 1) {
    cursor = addCadence(cursor, account.paymentCadence);
  }

  return toDateOnlyString(cursor);
}

function getBillStatusFromDate(dueDate: string, paid: boolean): BillStatus {
  if (paid) {
    return "Paid";
  }

  const due = getDateOnly(dueDate);
  if (!due) {
    return "Upcoming";
  }

  return due < getToday() ? "Past Due" : "Upcoming";
}

function hasOperationalDebtHistory(bill: Bill): boolean {
  return (
    bill.status === "Paid" ||
    Boolean(bill.paidDate) ||
    typeof bill.paidAmount === "number" ||
    Boolean(bill.paymentMethod) ||
    Boolean(bill.paymentNote) ||
    getBillLateFeeAmount(bill) > 0
  );
}

function buildProjectedDebtBills(account: DebtAccount, knownAccountIds?: Set<string>): Bill[] {
  if (!shouldProjectDebtAccount(account, knownAccountIds)) {
    return [];
  }

  const startingDate = getDateOnly(account.nextDueDate ?? "");
  if (!startingDate) {
    return [];
  }

  const scheduledAmount = getDebtScheduledAmount(account);
  const remainingCount = getDebtRemainingPaymentCount(account, scheduledAmount);
  const limit = getDebtProjectionLimit(account, remainingCount);
  const horizon = addDays(getToday(), DEBT_FORWARD_WINDOW_DAYS);
  const projected: Bill[] = [];
  let cursor = startingDate;
  let iterations = 0;

  while (iterations < limit && cursor <= horizon) {
    const dueDate = toDateOnlyString(cursor);
    projected.push({
      id: `debt-${account.id}-${dueDate}`,
      name: getDebtBillName(account),
      category: "Debt",
      status: getBillStatusFromDate(dueDate, false),
      dueDate,
      amount: scheduledAmount,
      notes: `${account.debtType} obligation derived from Debt.`,
      sourceType: "debt-derived",
      sourceDebtAccountId: account.id,
      sourceDebtType: account.debtType,
      sourceDebtOccurrenceDate: dueDate,
    });

    cursor = addCadence(cursor, account.paymentCadence);
    iterations += 1;
  }

  return projected;
}

export function mergeDebtBills(existingBills: Bill[], debtAccounts: DebtAccount[]): Bill[] {
  const manualBills = existingBills.filter((bill) => bill.sourceType !== "debt-derived");
  const existingDerivedBills = existingBills.filter((bill) => bill.sourceType === "debt-derived");
  const existingDerivedById = new Map(existingDerivedBills.map((bill) => [bill.id, bill]));
  const debtAccountIds = new Set(debtAccounts.map((account) => account.id));
  const projectedBills = debtAccounts.flatMap((account) =>
    buildProjectedDebtBills(account, debtAccountIds),
  );
  const projectedBillIds = new Set(projectedBills.map((bill) => bill.id));

  const mergedProjected = projectedBills.map((bill) => {
    const existing = existingDerivedById.get(bill.id);
    if (!existing) {
      return bill;
    }

    const isPaid = existing.status === "Paid";
    return {
      ...bill,
      status: getBillStatusFromDate(bill.dueDate, isPaid),
      lateFeeAmount: existing.lateFeeAmount,
      paidDate: existing.paidDate,
      paidAmount: existing.paidAmount,
      paymentMethod: existing.paymentMethod,
      paymentNote: existing.paymentNote,
      notes: existing.notes ?? bill.notes,
    };
  });

  const preservedHistory = existingDerivedBills.filter((bill) => {
    if (projectedBillIds.has(bill.id)) {
      return false;
    }

    if (hasOperationalDebtHistory(bill)) {
      return true;
    }

    const dueDate = getDateOnly(bill.dueDate);
    return Boolean(dueDate && dueDate < getToday());
  });

  return [...manualBills, ...mergedProjected, ...preservedHistory];
}

export function getDebtSchedule(account: DebtAccount, bills: Bill[]): DebtScheduleItem[] {
  return bills
    .filter((bill) => bill.sourceDebtAccountId === account.id)
    .map((bill) => ({
      id: `${account.id}-${bill.dueDate}`,
      debtAccountId: account.id,
      dueDate: bill.dueDate,
      amount: getBillTotalAmount(bill),
      status: bill.status,
      sourceBillId: bill.id,
    }))
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

export function calculateDebtDerivedMetrics(
  account: DebtAccount,
  bills: Bill[],
): DebtDerivedMetrics {
  const creditCardMinimumSystem =
    account.debtType === "Credit Card" ? buildCreditCardMinimumSystem(account) : undefined;
  const scheduledAmount =
    account.debtType === "Credit Card" && typeof creditCardMinimumSystem?.currentMinimumPayment === "number"
      ? normalizeAmount(creditCardMinimumSystem.currentMinimumPayment)
      : getDebtScheduledAmount(account);
  const projectionPaymentAmount =
    account.debtType === "Credit Card" && typeof creditCardMinimumSystem?.paymentAssumptionAmount === "number"
      ? normalizeAmount(creditCardMinimumSystem.paymentAssumptionAmount)
      : scheduledAmount;
  const remainingPaymentCount = getDebtRemainingPaymentCount(account, projectionPaymentAmount);
  const paymentAmountTrustState =
    account.debtType === "Credit Card" && creditCardMinimumSystem
      ? creditCardMinimumSystem.paymentAssumptionTrustState
      : getPaymentAmountTrustState(account, projectionPaymentAmount);
  const currentTermVersion = getEffectiveTermVersionAtDate(account, getToday());
  const currentEffectiveApr =
    typeof currentTermVersion?.apr === "number" ? currentTermVersion.apr : account.apr;
  const utilizationPercent =
    account.debtType === "Credit Card" &&
    typeof account.creditLimit === "number" &&
    account.creditLimit > 0
      ? normalizeAmount((account.currentBalance / account.creditLimit) * 100)
      : undefined;
  const estimatedMonthlyInterest =
    typeof currentEffectiveApr === "number" && currentEffectiveApr > 0
      ? normalizeAmount((account.currentBalance * currentEffectiveApr) / 1200)
      : undefined;
  const nextScheduledPaymentDate = account.nextDueDate;
  const scheduleItems = getDebtSchedule(account, bills);
  const lifecycle = buildDebtLifecycleSnapshot(account, bills);
  const { cashWindows, timingCluster, pastDueCatchUpAmount } = buildDebtCashWindows(
    account,
    scheduleItems,
  );
  const trustNotes: string[] = [];
  const projectionInputs = buildProjectionInputs(account, projectionPaymentAmount, paymentAmountTrustState);
  const projectionAssumptions = buildProjectionAssumptions(account, paymentAmountTrustState);
  const projectionBaseTrustState = getProjectionTrustState(account, paymentAmountTrustState);
  const startingDate = account.nextDueDate ? getDateOnly(account.nextDueDate) : null;
  const reliabilityIssues = buildReliabilityIssues(account, scheduledAmount, scheduleItems);
  let payoffTrustState: DebtMathTrustState = "Limited";
  let payoffDateProjection: string | undefined;
  let projectedRemainingInterest: number | undefined;
  let projectedRemainingInterestTrustState: DebtMathTrustState = "Limited";
  let limitationNote: string | undefined;
  let methodLabel = "Projection unavailable";
  const scenarios: DebtPayoffScenario[] = [];

  if (!account.nextDueDate) {
    trustNotes.push("Next due date is missing, so schedule visibility is limited.");
  }

  if (scheduledAmount <= 0) {
    trustNotes.push("Payment amount is missing, so payoff projection is limited.");
  } else if (
    account.debtType === "Credit Card" &&
    creditCardMinimumSystem?.paymentAssumptionMode === "Minimum Due" &&
    typeof creditCardMinimumSystem.currentMinimumPayment === "number"
  ) {
    trustNotes.push(
      `Projection is using the current minimum due of ${formatCurrency(
        creditCardMinimumSystem.currentMinimumPayment,
      )}.`,
    );
  } else if (paymentAmountTrustState === "Custom") {
    trustNotes.push("Projection uses a custom recurring payment instead of the baseline minimum payment.");
  } else if (paymentAmountTrustState === "Manual") {
    trustNotes.push("Projection uses a manually entered recurring payment amount without full amortization support.");
  } else if (paymentAmountTrustState === "Estimated") {
    trustNotes.push("Projection uses a recurring payment amount inferred from the current debt structure or fallback payment detail.");
  }

  if (typeof account.apr !== "number" && account.interestAccrual === "Interest Accruing") {
    trustNotes.push("Interest is accruing, but APR is missing.");
  }

  if (typeof account.promoBalance === "number" && account.promoBalance > 0 && !account.promoEndDate) {
    trustNotes.push("Promo balance is present, but promo end date is not recorded.");
  }

  if (account.isDelinquent && typeof account.daysPastDue !== "number") {
    trustNotes.push("Delinquency is marked, but days past due is not recorded.");
  }

  if (lifecycle.sourceConflicts.length > 0) {
    trustNotes.push(
      `${lifecycle.sourceConflicts.length} lifecycle conflict${lifecycle.sourceConflicts.length === 1 ? "" : "s"} are active and keep primary confidence conservative.`,
    );
  }

  if (lifecycle.duplicateSuppressedCount > 0) {
    trustNotes.push(
      `${lifecycle.duplicateSuppressedCount} duplicate lifecycle event${lifecycle.duplicateSuppressedCount === 1 ? "" : "s"} were suppressed to preserve auditability.`,
    );
  }

  if (lifecycle.activeOverlays.length > 0) {
    trustNotes.push(
      `${lifecycle.activeOverlays.length} active arrangement overlay${lifecycle.activeOverlays.length === 1 ? "" : "s"} are modifying or annotating standing behavior.`,
    );
  }

  const installmentProgressLabel =
    typeof account.totalPaymentCount === "number" && typeof account.completedPaymentCount === "number"
      ? `${account.completedPaymentCount} of ${account.totalPaymentCount} installments completed`
      : undefined;
  const installmentProgressTrustState: DebtMathTrustState | undefined = installmentProgressLabel
    ? "Manual"
    : undefined;
  const hasExplicitInstallmentCounts =
    typeof account.totalPaymentCount === "number" &&
    typeof account.completedPaymentCount === "number";

  if (
    account.lifecycleState === "Deferment" ||
    account.paymentRequirement === "No Payment Required"
  ) {
    limitationNote = "This account is not currently requiring payment, so active payoff projection is limited.";
    trustNotes.push("Payment requirement or lifecycle state currently pauses active payoff modeling.");
  } else if (!startingDate) {
    limitationNote = "A valid next due date is required to project payoff timing.";
  } else {
    const baseProjection = simulatePayoffProjection(account, startingDate, projectionPaymentAmount);

    if (baseProjection) {
      payoffDateProjection = baseProjection.payoffDate;
      payoffTrustState = projectionBaseTrustState;
      projectedRemainingInterest =
        account.interestAccrual === "No Interest Accruing"
          ? 0
          : baseProjection.totalInterest;
      projectedRemainingInterestTrustState =
        account.interestAccrual === "No Interest Accruing"
          ? "Exact"
          : projectionBaseTrustState;
      methodLabel =
        account.debtType === "Credit Card"
          ? "Constant payment approximation"
          : account.interestAccrual === "No Interest Accruing"
            ? "Fixed payment schedule"
            : "Stable payment + APR projection";

      if (account.debtType === "Credit Card") {
        limitationNote =
          "Credit-card projections use the active payment assumption, but they still hold that amount constant and do not simulate future statement changes.";
        trustNotes.push(limitationNote);
      } else if (account.interestAccrual === "Interest Accruing") {
        trustNotes.push("Payoff projection assumes APR and payment amount remain stable.");
      } else {
        trustNotes.push("Payoff projection is exact under the current no-interest payment schedule.");
      }

      const periodsPerMonth = getPeriodsPerYear(account.paymentCadence) / 12;
      for (const extraPaymentAmount of DEBT_EXTRA_PAYMENT_OPTIONS) {
        const scenarioPaymentAmount = normalizeAmount(projectionPaymentAmount + extraPaymentAmount);
        const scenarioProjection = simulatePayoffProjection(account, startingDate, scenarioPaymentAmount);
        if (!scenarioProjection) {
          scenarios.push({
            id: `${account.id}-extra-${extraPaymentAmount}`,
            label: `+$${extraPaymentAmount.toFixed(0)}`,
            extraPaymentAmount,
            totalPaymentAmount: scenarioPaymentAmount,
            trustState: "Limited",
            note: "This extra-payment projection is limited by the current payment or interest inputs.",
          });
          continue;
        }

        const monthsSavedRaw =
          periodsPerMonth > 0
            ? normalizeAmount(
                (baseProjection.periodCount - scenarioProjection.periodCount) / periodsPerMonth,
              )
            : undefined;

        scenarios.push({
          id: `${account.id}-extra-${extraPaymentAmount}`,
          label: `+$${extraPaymentAmount.toFixed(0)}`,
          extraPaymentAmount,
          totalPaymentAmount: scenarioPaymentAmount,
          payoffDate: scenarioProjection.payoffDate,
          monthsSaved: monthsSavedRaw && monthsSavedRaw > 0 ? monthsSavedRaw : 0,
          projectedInterestSaved:
            account.interestAccrual === "No Interest Accruing"
              ? 0
              : normalizeAmount(baseProjection.totalInterest - scenarioProjection.totalInterest),
          trustState: getScenarioTrustState(account, paymentAmountTrustState),
          note:
            account.debtType === "Credit Card"
              ? "Limited scenario assumes the entered credit-card payment stays fixed and does not model changing minimum-payment rules."
              : paymentAmountTrustState === "Custom"
                ? "Custom scenario uses the current custom recurring payment plus the added amount."
                : account.interestAccrual === "No Interest Accruing"
                  ? "Exact scenario uses the current fixed payment plus the added amount."
                  : paymentAmountTrustState === "Manual"
                    ? "Manual scenario uses the entered recurring payment plus the added amount under a stable-APR model."
                    : "Estimated scenario uses the current recurring payment plus the added amount under a stable-APR model."
              ,
        });
      }
    } else if (
      typeof remainingPaymentCount === "number" &&
      remainingPaymentCount > 0 &&
      (hasExplicitInstallmentCounts || account.interestAccrual === "No Interest Accruing")
    ) {
      payoffDateProjection = buildCountBasedPayoffDate(account, remainingPaymentCount);
      payoffTrustState = "Exact";
      projectedRemainingInterest =
        account.interestAccrual === "No Interest Accruing" ? 0 : undefined;
      projectedRemainingInterestTrustState =
        account.interestAccrual === "No Interest Accruing" ? "Exact" : "Limited";
      methodLabel = "Installment count schedule";
      limitationNote =
        "Payoff date is derived from the remaining installment count. Extra-payment and interest-saving scenarios need stronger payment or APR detail.";
      trustNotes.push(
        "Payoff timing uses the remaining installment count because payment-based payoff simulation is limited.",
      );
    } else {
      limitationNote =
        "Current inputs are not sufficient to project payoff timing. Add a due date, recurring payment, and interest detail where needed.";
    }
  }

  const debtBills = bills.filter((bill) => bill.sourceDebtAccountId === account.id && bill.status === "Paid");
  if (debtBills.length > 0) {
    trustNotes.push(`${debtBills.length} debt-linked payment${debtBills.length === 1 ? "" : "s"} have been recorded in Bills.`);
  }

  const projection: DebtPayoffProjection = {
    methodLabel,
    payoffDate: payoffDateProjection,
    payoffDateTrustState: payoffTrustState,
    projectedRemainingInterest,
    projectedRemainingInterestTrustState,
    paymentAmountUsed: projectionPaymentAmount,
    paymentAmountTrustState,
    limitationNote,
    inputs: projectionInputs,
    assumptions: projectionAssumptions,
    scenarios,
  };

  const factualFlags = buildDebtFactualFlags({
    account,
    lifecycle,
    scheduledAmount,
    utilizationPercent,
    timingCluster,
    reliabilityIssues,
  });
  const consequences = buildDebtConsequences({
    account,
    lifecycle,
    estimatedMonthlyInterest,
    pastDueCatchUpAmount,
  });

  return {
    lifecycle,
    nextScheduledPaymentAmount: scheduledAmount,
    nextScheduledPaymentDate,
    remainingBalance: normalizeAmount(account.currentBalance),
    remainingPaymentCount,
    remainingPaymentCountTrustState:
      typeof remainingPaymentCount === "number"
        ? typeof account.totalPaymentCount === "number" &&
          typeof account.completedPaymentCount === "number"
          ? "Exact"
          : "Estimated"
        : undefined,
    payoffDateProjection,
    payoffTrustState,
    projectedRemainingInterest,
    projectedRemainingInterestTrustState,
    paymentAmountTrustState,
    utilizationPercent,
    estimatedMonthlyInterest,
    estimatedMonthlyInterestTrustState:
      typeof estimatedMonthlyInterest === "number"
        ? account.debtType === "Credit Card"
          ? "Limited"
          : "Estimated"
        : undefined,
    installmentProgressLabel,
    installmentProgressTrustState,
    creditCardMinimumSystem,
    cashWindows,
    timingCluster,
    factualFlags,
    consequences,
    trustNotes,
    projection,
  };
}

export function calculateDebtSummary(accounts: DebtAccount[], bills: Bill[]): DebtSummary {
  const relevantBills = bills.filter((bill) => bill.sourceType === "debt-derived");
  const accountMetrics = accounts.map((account) => calculateDebtDerivedMetrics(account, bills));
  const upcomingWindow = addDays(getToday(), DEBT_FORWARD_WINDOW_DAYS);
  const upcomingBills = relevantBills.filter((bill) => {
    if (bill.status === "Paid") {
      return false;
    }

    const dueDate = getDateOnly(bill.dueDate);
    return Boolean(dueDate && dueDate <= upcomingWindow);
  });

  const nextBill = upcomingBills
    .slice()
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
  const accountWindows = accounts.map((account) =>
    buildDebtCashWindows(account, getDebtSchedule(account, bills)).cashWindows,
  );
  const requiredPaymentsIn14Days = normalizeAmount(
    accountWindows.reduce((sum, windows) => sum + windows[0].requiredPaymentTotal, 0),
  );
  const requiredPaymentsIn30Days = normalizeAmount(
    accountWindows.reduce((sum, windows) => sum + windows[1].requiredPaymentTotal, 0),
  );
  const requiredPaymentsIn60Days = normalizeAmount(
    accountWindows.reduce((sum, windows) => sum + windows[2].requiredPaymentTotal, 0),
  );
  const minimumCashNeededIn14Days = normalizeAmount(
    accountWindows.reduce((sum, windows) => sum + windows[0].minimumCashNeededToStayCurrent, 0),
  );
  const minimumCashNeededIn30Days = normalizeAmount(
    accountWindows.reduce((sum, windows) => sum + windows[1].minimumCashNeededToStayCurrent, 0),
  );
  const minimumCashNeededIn60Days = normalizeAmount(
    accountWindows.reduce((sum, windows) => sum + windows[2].minimumCashNeededToStayCurrent, 0),
  );
  const timingCluster = buildTimingClusterFromEntries(
    relevantBills
      .filter((bill) => bill.status !== "Paid")
      .map((bill) => ({ dueDate: bill.dueDate, amount: getBillTotalAmount(bill) })),
  );

  return {
    totalDebtBalance: normalizeAmount(
      accounts.reduce((sum, account) => sum + account.currentBalance, 0),
    ),
    activeAccountCount: accountMetrics.filter(
      (metrics) => metrics.lifecycle.standingState !== "inactive" && metrics.lifecycle.standingState !== "paid_off" && metrics.lifecycle.standingState !== "resolved",
    ).length,
    delinquentAccountCount: accountMetrics.filter(
      (metrics) => metrics.lifecycle.standingState === "delinquent",
    ).length,
    lateAccountCount: accountMetrics.filter(
      (metrics) => metrics.lifecycle.standingState === "late" || metrics.lifecycle.standingState === "grace_window",
    ).length,
    noPaymentRequiredCount: accounts.filter(
      (account) =>
        account.paymentRequirement === "No Payment Required" ||
        account.lifecycleState === "Deferment",
    ).length,
    activeHardshipCount: accountMetrics.filter((metrics) =>
      metrics.lifecycle.activeOverlays.some((overlay) => overlay.type === "hardship_active"),
    ).length,
    failedPaymentCount: accountMetrics.reduce(
      (sum, metrics) => sum + metrics.lifecycle.failedPaymentCount,
      0,
    ),
    collectionsCount: accountMetrics.filter(
      (metrics) =>
        metrics.lifecycle.standingState === "collections" ||
        metrics.lifecycle.standingState === "charged_off",
    ).length,
    amountNeededToCureTotal: normalizeAmount(
      accountMetrics.reduce((sum, metrics) => sum + metrics.lifecycle.amountNeededToCure, 0),
    ),
    requiredPaymentsIn14Days,
    requiredPaymentsIn30Days,
    requiredPaymentsIn60Days,
    minimumCashNeededIn14Days,
    minimumCashNeededIn30Days,
    minimumCashNeededIn60Days,
    totalMinimumDueIn60Days: normalizeAmount(
      upcomingBills.reduce((sum, bill) => sum + getBillTotalAmount(bill), 0),
    ),
    nextDebtDueDate: nextBill?.dueDate,
    nextDebtDueAmount: nextBill ? getBillTotalAmount(nextBill) : 0,
    timingClusterCount: timingCluster?.count ?? 0,
    timingClusterNote: timingCluster?.note,
  };
}

function buildPaymentAssumptionFact(
  account: DebtAccount,
  metrics: DebtDerivedMetrics,
): DebtPaymentAssumptionFact {
  const creditCardMinimumSystem = metrics.creditCardMinimumSystem;
  if (creditCardMinimumSystem) {
    const paymentAssumptionAmount =
      typeof creditCardMinimumSystem.paymentAssumptionAmount === "number"
        ? normalizeAmount(creditCardMinimumSystem.paymentAssumptionAmount)
        : undefined;

    return {
      label: creditCardMinimumSystem.paymentAssumptionMode,
      amount: paymentAssumptionAmount,
      trustState: creditCardMinimumSystem.paymentAssumptionTrustState,
      detail:
        paymentAssumptionAmount && paymentAssumptionAmount > 0
          ? `Projection uses ${creditCardMinimumSystem.paymentAssumptionMode.toLowerCase()} at ${formatCurrency(
              paymentAssumptionAmount,
            )}.`
          : `Projection uses the ${creditCardMinimumSystem.paymentAssumptionMode.toLowerCase()} payment assumption from Debt account truth.`,
    };
  }

  return {
    label: "Scheduled Payment",
    amount: metrics.projection.paymentAmountUsed,
    trustState: metrics.paymentAmountTrustState,
    detail:
      metrics.paymentAmountTrustState === "Custom"
        ? "Projection uses a custom recurring payment captured in Debt."
        : metrics.paymentAmountTrustState === "Manual"
          ? "Projection uses the manually entered recurring payment from Debt."
          : metrics.paymentAmountTrustState === "Estimated"
            ? "Projection uses the current scheduled payment under a stable-APR or inferred-payment assumption."
            : "Projection uses the current scheduled payment from Debt account truth.",
  };
}

function getPrimaryConfidenceState(metrics: DebtDerivedMetrics): DebtMathTrustState {
  const trustStates = [
    metrics.paymentAmountTrustState,
    metrics.payoffTrustState,
    metrics.projectedRemainingInterestTrustState,
  ];
  const hasReliabilityLimits = metrics.factualFlags.some(
    (flag) => flag.type === "Missing Key Inputs Limiting Reliability",
  );
  const hasLifecycleConflicts = metrics.lifecycle.sourceConflicts.length > 0;

  if (hasReliabilityLimits || hasLifecycleConflicts || trustStates.includes("Limited")) {
    return "Limited";
  }
  if (trustStates.includes("Custom")) {
    return "Custom";
  }
  if (trustStates.includes("Manual")) {
    return "Manual";
  }
  if (trustStates.includes("Estimated")) {
    return "Estimated";
  }
  return "Exact";
}

function getPrimaryConfidenceDetail(
  metrics: DebtDerivedMetrics,
  confidenceState: DebtMathTrustState,
): string {
  if (confidenceState === "Limited") {
    return metrics.lifecycle.sourceConflicts.length > 0
      ? "Primary confidence is limited because lifecycle conflicts or unresolved source disagreements are still active."
      : "Primary confidence is limited because at least one downstream debt input is still missing or only partially supported.";
  }
  if (confidenceState === "Custom") {
    return "Primary confidence reflects a custom payment rule or custom payment assumption, not a baseline scheduled-payment read.";
  }
  if (confidenceState === "Manual") {
    return "Primary confidence is driven by manual payment inputs even though downstream outputs remain usable.";
  }
  if (confidenceState === "Estimated") {
    return "Primary confidence is based on stable-rate or inferred-payment assumptions rather than a fully verified amortization path.";
  }

  return "Primary confidence reflects aligned payment, payoff, and remaining-interest support from current debt truth.";
}

function buildLinkedScheduleFact(
  account: DebtAccount,
  bills: Bill[],
): DebtLinkedScheduleFact {
  const schedule = getDebtSchedule(account, bills);
  const boundedSchedule = getBoundedOperationalScheduleEntries(schedule);

  return {
    billCount: boundedSchedule.length,
    firstDueDate: boundedSchedule[0]?.dueDate,
    lastDueDate: boundedSchedule[boundedSchedule.length - 1]?.dueDate,
    boundedWindowDays: DEBT_OPERATIONAL_WINDOW_DAYS,
    editableInBills: false,
    owner: "Debt",
    boundaryNote:
      "Bills receives bounded unpaid upcoming rows only. Past-due catch-up stays in Debt cash windows so near-term obligations do not double count overdue pressure.",
  };
}

function buildNearTermObligations(
  accounts: DebtAccount[],
  bills: Bill[],
): DebtDownstreamObligation[] {
  return accounts
    .flatMap((account) =>
      getBoundedOperationalScheduleEntries(getDebtSchedule(account, bills))
        .map((item) => ({
          billId: item.sourceBillId,
          accountId: account.id,
          providerName: account.providerName,
          debtType: account.debtType,
          dueDate: item.dueDate,
          amount: item.amount,
          status: item.status,
        })),
    )
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

export function buildDebtDownstreamSnapshot(
  accounts: DebtAccount[],
  bills: Bill[],
): DebtDownstreamSnapshot {
  const summary = calculateDebtSummary(accounts, bills);
  const confidenceSummary: Record<DebtMathTrustState, number> = {
    Exact: 0,
    Estimated: 0,
    Limited: 0,
    Custom: 0,
    Manual: 0,
  };

  const accountFacts: DebtDownstreamAccountFact[] = accounts.map((account) => {
    const metrics = calculateDebtDerivedMetrics(account, bills);
    const primaryConfidenceState = getPrimaryConfidenceState(metrics);
    confidenceSummary[primaryConfidenceState] += 1;

    return {
      accountId: account.id,
      providerName: account.providerName,
      debtType: account.debtType,
      standingState: metrics.lifecycle.standingState,
      standingExplanation: metrics.lifecycle.standingExplanation,
      activeOverlays: metrics.lifecycle.activeOverlays,
      amountNeededToCure: metrics.lifecycle.amountNeededToCure,
      daysPastDue: metrics.lifecycle.daysPastDue,
      nextEscalationDate: metrics.lifecycle.nextEscalationDate,
      failedPaymentCount: metrics.lifecycle.failedPaymentCount,
      lifecycleState: account.lifecycleState,
      paymentRequirement: account.paymentRequirement,
      interestAccrual: account.interestAccrual,
      currentBalance: normalizeAmount(account.currentBalance),
      nextScheduledPaymentAmount: metrics.nextScheduledPaymentAmount,
      nextScheduledPaymentDate: metrics.nextScheduledPaymentDate,
      nextScheduledPaymentTrustState: metrics.paymentAmountTrustState,
      payoffDateProjection: metrics.payoffDateProjection,
      payoffTrustState: metrics.payoffTrustState,
      projectedRemainingInterest: metrics.projectedRemainingInterest,
      projectedRemainingInterestTrustState:
        metrics.projectedRemainingInterestTrustState,
      paymentAssumption: buildPaymentAssumptionFact(account, metrics),
      cashWindows: metrics.cashWindows,
      timingCluster: metrics.timingCluster,
      factualFlags: metrics.factualFlags,
      consequences: metrics.consequences,
      extraPaymentImpact: metrics.projection.scenarios,
      linkedSchedule: buildLinkedScheduleFact(account, bills),
      eventTimeline: metrics.lifecycle.eventTimeline,
      sourceConflicts: metrics.lifecycle.sourceConflicts,
      sourceQualitySummary: metrics.lifecycle.sourceQualitySummary,
      continuity: metrics.lifecycle.continuity,
      primaryConfidenceState,
      primaryConfidenceDetail: getPrimaryConfidenceDetail(metrics, primaryConfidenceState),
    };
  });

  return {
    summary,
    accountFacts,
    nearTermObligations: buildNearTermObligations(accounts, bills),
    confidenceSummary,
    flaggedAccountCount: accountFacts.filter((fact) => fact.factualFlags.length > 0).length,
    consequenceAccountCount: accountFacts.filter((fact) => fact.consequences.length > 0)
      .length,
    limitedConfidenceAccountCount: accountFacts.filter(
      (fact) => fact.primaryConfidenceState === "Limited",
    ).length,
    lifecycleAlertCount: accountFacts.filter(
      (fact) =>
        fact.standingState === "late" ||
        fact.standingState === "delinquent" ||
        fact.standingState === "collections" ||
        fact.failedPaymentCount > 0 ||
        fact.sourceConflicts.length > 0,
    ).length,
    boundedOperationalWindowDays: DEBT_OPERATIONAL_WINDOW_DAYS,
  };
}
