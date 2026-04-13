import type {
  Bill,
  BillStatus,
  DebtAccount,
  DebtDerivedMetrics,
  DebtMathInspectableItem,
  DebtMathTrustState,
  DebtPaymentCadence,
  DebtPayoffProjection,
  DebtPayoffScenario,
  DebtScheduleItem,
  DebtSummary,
} from "@/lib/types";
import {
  formatCurrency,
  getBillLateFeeAmount,
  getBillTotalAmount,
  isValidDateOnly,
  normalizeAmount,
} from "@/lib/utils";

const DEBT_FORWARD_WINDOW_DAYS = 60;
const DEBT_EXTRA_PAYMENT_OPTIONS = [50, 100, 200] as const;
const MAX_PROJECTION_PERIODS = 1_200;

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

function shouldProjectDebtAccount(account: DebtAccount): boolean {
  if (account.currentBalance <= 0) {
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
          : typeof account.apr === "number" && account.apr > 0
            ? `${normalizeAmount(account.apr).toFixed(2)}% APR`
            : "APR missing",
      state: interestModelTrustState,
      note:
        account.interestAccrual === "No Interest Accruing"
          ? "Projection uses a zero-interest payoff path."
          : typeof account.apr === "number" && account.apr > 0
            ? account.debtType === "Credit Card"
              ? "APR is available, but credit-card payoff math remains trust-limited in V2A."
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
      note: "V2A assumes the recurring payment amount does not change between due dates.",
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
          ? "V2A does not model changing credit-card minimum rules. This projection assumes the entered payment stays constant."
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
    note: "V2A is a static projection. It does not simulate future behavior changes.",
  });

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
  const periodRate =
    account.interestAccrual === "Interest Accruing" && typeof account.apr === "number" && account.apr > 0
      ? account.apr / 100 / periodsPerYear
      : 0;

  if (periodRate > 0 && normalizeAmount(account.currentBalance * periodRate) >= paymentAmount) {
    return null;
  }

  let cursor = new Date(startingDate);
  let remainingBalance = normalizeAmount(account.currentBalance);
  let totalInterest = 0;
  let periodCount = 0;

  while (remainingBalance > 0.005 && periodCount < MAX_PROJECTION_PERIODS) {
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

function buildProjectedDebtBills(account: DebtAccount): Bill[] {
  if (!shouldProjectDebtAccount(account)) {
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
  const projectedBills = debtAccounts.flatMap((account) => buildProjectedDebtBills(account));
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
  const scheduledAmount = getDebtScheduledAmount(account);
  const remainingPaymentCount = getDebtRemainingPaymentCount(account, scheduledAmount);
  const paymentAmountTrustState = getPaymentAmountTrustState(account, scheduledAmount);
  const utilizationPercent =
    account.debtType === "Credit Card" &&
    typeof account.creditLimit === "number" &&
    account.creditLimit > 0
      ? normalizeAmount((account.currentBalance / account.creditLimit) * 100)
      : undefined;
  const estimatedMonthlyInterest =
    typeof account.apr === "number" && account.apr > 0
      ? normalizeAmount((account.currentBalance * account.apr) / 1200)
      : undefined;
  const nextScheduledPaymentDate = account.nextDueDate;
  const trustNotes: string[] = [];
  const projectionInputs = buildProjectionInputs(account, scheduledAmount, paymentAmountTrustState);
  const projectionAssumptions = buildProjectionAssumptions(account, paymentAmountTrustState);
  const projectionBaseTrustState = getProjectionTrustState(account, paymentAmountTrustState);
  const startingDate = account.nextDueDate ? getDateOnly(account.nextDueDate) : null;
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
    const baseProjection = simulatePayoffProjection(account, startingDate, scheduledAmount);

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
          "Credit card minimum payment rules are not modeled in V2A. Projections assume the entered payment stays constant.";
        trustNotes.push(limitationNote);
      } else if (account.interestAccrual === "Interest Accruing") {
        trustNotes.push("Payoff projection assumes APR and payment amount remain stable.");
      } else {
        trustNotes.push("Payoff projection is exact under the current no-interest payment schedule.");
      }

      const periodsPerMonth = getPeriodsPerYear(account.paymentCadence) / 12;
      for (const extraPaymentAmount of DEBT_EXTRA_PAYMENT_OPTIONS) {
        const scenarioPaymentAmount = normalizeAmount(scheduledAmount + extraPaymentAmount);
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
    paymentAmountUsed: scheduledAmount,
    paymentAmountTrustState,
    limitationNote,
    inputs: projectionInputs,
    assumptions: projectionAssumptions,
    scenarios,
  };

  return {
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
    trustNotes,
    projection,
  };
}

export function calculateDebtSummary(accounts: DebtAccount[], bills: Bill[]): DebtSummary {
  const relevantBills = bills.filter((bill) => bill.sourceType === "debt-derived");
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

  return {
    totalDebtBalance: normalizeAmount(
      accounts.reduce((sum, account) => sum + account.currentBalance, 0),
    ),
    activeAccountCount: accounts.filter((account) => account.lifecycleState === "Active").length,
    delinquentAccountCount: accounts.filter((account) => account.isDelinquent).length,
    noPaymentRequiredCount: accounts.filter(
      (account) =>
        account.paymentRequirement === "No Payment Required" ||
        account.lifecycleState === "Deferment",
    ).length,
    totalMinimumDueIn60Days: normalizeAmount(
      upcomingBills.reduce((sum, bill) => sum + getBillTotalAmount(bill), 0),
    ),
    nextDebtDueDate: nextBill?.dueDate,
    nextDebtDueAmount: nextBill ? getBillTotalAmount(nextBill) : 0,
  };
}
