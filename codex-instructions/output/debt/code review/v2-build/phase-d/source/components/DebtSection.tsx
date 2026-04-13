"use client";

import {
  BadgeDollarSign,
  CalendarClock,
  Car,
  ChevronDown,
  ChevronUp,
  CreditCard,
  GraduationCap,
  HandCoins,
  PiggyBank,
  PlusCircle,
  ReceiptText,
  Save,
  ShieldAlert,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  DEBT_INTEREST_ACCRUAL_OPTIONS,
  DEBT_LIFECYCLE_STATES,
  DEBT_PAYMENT_CADENCES,
  DEBT_PAYMENT_REQUIREMENTS,
  DEBT_GRACE_PERIOD_STATUSES,
  DEBT_PROMO_TYPES,
  DEBT_TYPES,
  CREDIT_CARD_CUSTOM_RULE_OPERATION_MODES,
  CREDIT_CARD_MINIMUM_PAYMENT_MODES,
  CREDIT_CARD_PAYMENT_ASSUMPTION_MODES,
  type Bill,
  type CreditCardCustomMinimumRule,
  type CreditCardCustomRuleOperationMode,
  type CreditCardMinimumPaymentMode,
  type CreditCardPaymentAssumptionMode,
  type CreditCardPresetRuleId,
  type CreditCardRuleValidationState,
  type DebtAccount,
  type DebtCashWindow,
  type DebtConsequenceItem,
  type DebtDerivedMetrics,
  type DebtDownstreamAccountFact,
  type DebtDownstreamSnapshot,
  type DebtFactualFlag,
  type DebtGracePeriodStatus,
  type DebtInterestAccrual,
  type DebtLifecycleState,
  type DebtMathInspectableItem,
  type DebtMathTrustState,
  type DebtPaymentCadence,
  type DebtPaymentRequirement,
  type DebtPromoType,
  type DebtScheduleItem,
  type DebtSummary,
  type DebtType,
} from "@/lib/types";
import {
  calculateDebtDerivedMetrics,
  getDebtSchedule,
} from "@/lib/debt";
import {
  buildCreditCardMinimumSystem,
  getCreditCardPresetLibrary,
} from "@/lib/debt-credit-card";
import { formatCurrency, formatDate, normalizeAmount } from "@/lib/utils";

type DebtSectionProps = {
  accounts: DebtAccount[];
  bills: Bill[];
  summary: DebtSummary;
  downstreamSnapshot: DebtDownstreamSnapshot;
  focusedAccountId?: string;
  onSaveAccount: (account: DebtAccount) => void;
  onDeleteAccount: (accountId: string) => void;
};

type DebtFormState = {
  providerName: string;
  issuerName: string;
  debtType: DebtType;
  currentBalance: string;
  originalAmount: string;
  statementBalance: string;
  statementMinimumDue: string;
  apr: string;
  creditLimit: string;
  interestCharged: string;
  feesCharged: string;
  pastDueAmount: string;
  daysPastDue: string;
  lateFeeAmount: string;
  promoType: DebtPromoType;
  promoEndDate: string;
  promoBalance: string;
  regularPurchaseBalance: string;
  cashAdvanceBalance: string;
  gracePeriodStatus: DebtGracePeriodStatus;
  termLengthMonths: string;
  totalPaymentCount: string;
  completedPaymentCount: string;
  paymentCadence: DebtPaymentCadence;
  nextDueDate: string;
  minimumPayment: string;
  scheduledPaymentAmount: string;
  minimumPaymentMode: CreditCardMinimumPaymentMode;
  minimumPaymentPresetId: CreditCardPresetRuleId;
  paymentAssumptionMode: CreditCardPaymentAssumptionMode;
  paymentAssumptionCustomAmount: string;
  lastVerifiedAgainstStatement: string;
  customRuleName: string;
  customRulePrincipalVariable: CreditCardCustomMinimumRule["principalVariable"];
  customRuleOperationMode: CreditCardCustomRuleOperationMode;
  customRulePercentageValue: string;
  customRuleFixedAmount: string;
  customRuleThresholdAmount: string;
  customRuleUseFullBalanceBelowThreshold: boolean;
  customRuleIncludeInterestCharged: boolean;
  customRuleIncludeFeesCharged: boolean;
  customRuleIncludePastDueAmount: boolean;
  customRuleIncludeLateFeeAmount: boolean;
  customRuleIncludePromoBalance: boolean;
  customRuleIncludeRegularPurchaseBalance: boolean;
  customRuleIncludeCashAdvanceBalance: boolean;
  lifecycleState: DebtLifecycleState;
  paymentRequirement: DebtPaymentRequirement;
  interestAccrual: DebtInterestAccrual;
  isDelinquent: boolean;
  notes: string;
};

const debtTypeIcons: Record<DebtType, typeof CreditCard> = {
  "Credit Card": CreditCard,
  "Auto Loan": Car,
  "Student Loan": GraduationCap,
  "Installment Loan": WalletCards,
  BNPL: ReceiptText,
  "Financed Purchase": PiggyBank,
};

const trustStateClasses: Record<DebtMathTrustState, string> = {
  Exact: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Estimated: "border-blue-200 bg-blue-50 text-blue-700",
  Limited: "border-amber-200 bg-amber-50 text-amber-700",
  Custom: "border-violet-200 bg-violet-50 text-violet-700",
  Manual: "border-slate-200 bg-slate-100 text-slate-700",
};

const validationStateClasses: Record<CreditCardRuleValidationState, string> = {
  Valid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Incomplete: "border-blue-200 bg-blue-50 text-blue-700",
  Broken: "border-rose-200 bg-rose-50 text-rose-700",
  "Missing Required Inputs": "border-amber-200 bg-amber-50 text-amber-700",
};

const creditCardRuleVariableOptions: Array<{
  value: CreditCardCustomMinimumRule["principalVariable"];
  label: string;
}> = [
  { value: "statement_balance", label: "Statement balance" },
  { value: "current_balance", label: "Current balance" },
  { value: "balance_subject_to_minimum", label: "Balance subject to minimum" },
  { value: "promo_balance", label: "Promo balance" },
  { value: "regular_purchase_balance", label: "Regular purchase balance" },
  { value: "cash_advance_balance", label: "Cash advance balance" },
  { value: "past_due_amount", label: "Past due amount" },
  { value: "interest_charged", label: "Interest charged" },
  { value: "fees_charged", label: "Fees charged" },
  { value: "late_fee_amount", label: "Late fee amount" },
];

const customRuleOperationDescriptions: Record<CreditCardCustomRuleOperationMode, string> = {
  "Percent Only": "Use only a percentage of the selected balance base.",
  "Flat Only": "Use only a flat floor amount.",
  "Percent Plus Flat": "Add the percentage result and the flat floor together.",
  "Greater Of Flat Or Percent": "Use whichever is larger: the flat floor or the percentage result.",
  "Lesser Of Flat Or Percent": "Use whichever is smaller: the flat floor or the percentage result.",
};

function operationNeedsPercent(mode: CreditCardCustomRuleOperationMode): boolean {
  return mode !== "Flat Only";
}

function operationNeedsFlat(mode: CreditCardCustomRuleOperationMode): boolean {
  return mode !== "Percent Only";
}

const defaultFormState: DebtFormState = {
  providerName: "",
  issuerName: "",
  debtType: "Credit Card",
  currentBalance: "",
  originalAmount: "",
  statementBalance: "",
  statementMinimumDue: "",
  apr: "",
  creditLimit: "",
  interestCharged: "",
  feesCharged: "",
  pastDueAmount: "",
  daysPastDue: "",
  lateFeeAmount: "",
  promoType: "Intro APR",
  promoEndDate: "",
  promoBalance: "",
  regularPurchaseBalance: "",
  cashAdvanceBalance: "",
  gracePeriodStatus: "Grace Period Active",
  termLengthMonths: "",
  totalPaymentCount: "",
  completedPaymentCount: "",
  paymentCadence: "Monthly",
  nextDueDate: "",
  minimumPayment: "",
  scheduledPaymentAmount: "",
  minimumPaymentMode: "Preset Rule",
  minimumPaymentPresetId: "greater-of-flat-or-percent-statement",
  paymentAssumptionMode: "Minimum Due",
  paymentAssumptionCustomAmount: "",
  lastVerifiedAgainstStatement: "",
  customRuleName: "Custom Card Rule",
  customRulePrincipalVariable: "statement_balance",
  customRuleOperationMode: "Greater Of Flat Or Percent",
  customRulePercentageValue: "1",
  customRuleFixedAmount: "35",
  customRuleThresholdAmount: "35",
  customRuleUseFullBalanceBelowThreshold: false,
  customRuleIncludeInterestCharged: false,
  customRuleIncludeFeesCharged: false,
  customRuleIncludePastDueAmount: false,
  customRuleIncludeLateFeeAmount: false,
  customRuleIncludePromoBalance: false,
  customRuleIncludeRegularPurchaseBalance: false,
  customRuleIncludeCashAdvanceBalance: false,
  lifecycleState: "Active",
  paymentRequirement: "Payment Required",
  interestAccrual: "Interest Accruing",
  isDelinquent: false,
  notes: "",
};

function createDebtId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseOptionalAmount(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  const normalized = normalizeAmount(parsed);
  if (!Number.isFinite(normalized)) {
    return undefined;
  }

  return normalized;
}

function parseOptionalInteger(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return undefined;
  }

  return parsed;
}

function buildFormState(account?: DebtAccount | null): DebtFormState {
  if (!account) {
    return defaultFormState;
  }

  return {
    providerName: account.providerName,
    issuerName: account.issuerName ?? "",
    debtType: account.debtType,
    currentBalance: account.currentBalance.toString(),
    originalAmount: typeof account.originalAmount === "number" ? account.originalAmount.toString() : "",
    statementBalance:
      typeof account.statementBalance === "number" ? account.statementBalance.toString() : "",
    statementMinimumDue:
      typeof account.statementMinimumDue === "number" ? account.statementMinimumDue.toString() : "",
    apr: typeof account.apr === "number" ? account.apr.toString() : "",
    creditLimit: typeof account.creditLimit === "number" ? account.creditLimit.toString() : "",
    interestCharged:
      typeof account.interestCharged === "number" ? account.interestCharged.toString() : "",
    feesCharged: typeof account.feesCharged === "number" ? account.feesCharged.toString() : "",
    pastDueAmount:
      typeof account.pastDueAmount === "number" ? account.pastDueAmount.toString() : "",
    daysPastDue:
      typeof account.daysPastDue === "number" ? account.daysPastDue.toString() : "",
    lateFeeAmount:
      typeof account.lateFeeAmount === "number" ? account.lateFeeAmount.toString() : "",
    promoType: account.promoType ?? "Intro APR",
    promoEndDate: account.promoEndDate ?? "",
    promoBalance: typeof account.promoBalance === "number" ? account.promoBalance.toString() : "",
    regularPurchaseBalance:
      typeof account.regularPurchaseBalance === "number"
        ? account.regularPurchaseBalance.toString()
        : "",
    cashAdvanceBalance:
      typeof account.cashAdvanceBalance === "number" ? account.cashAdvanceBalance.toString() : "",
    gracePeriodStatus: account.gracePeriodStatus ?? "Grace Period Active",
    termLengthMonths:
      typeof account.termLengthMonths === "number" ? account.termLengthMonths.toString() : "",
    totalPaymentCount:
      typeof account.totalPaymentCount === "number" ? account.totalPaymentCount.toString() : "",
    completedPaymentCount:
      typeof account.completedPaymentCount === "number"
        ? account.completedPaymentCount.toString()
        : "",
    paymentCadence: account.paymentCadence,
    nextDueDate: account.nextDueDate ?? "",
    minimumPayment:
      typeof account.minimumPayment === "number" ? account.minimumPayment.toString() : "",
    scheduledPaymentAmount:
      typeof account.scheduledPaymentAmount === "number"
        ? account.scheduledPaymentAmount.toString()
        : "",
    minimumPaymentMode: account.minimumPaymentMode ?? "Preset Rule",
    minimumPaymentPresetId:
      account.minimumPaymentPresetId ?? "greater-of-flat-or-percent-statement",
    paymentAssumptionMode: account.paymentAssumptionMode ?? "Minimum Due",
    paymentAssumptionCustomAmount:
      typeof account.paymentAssumptionCustomAmount === "number"
        ? account.paymentAssumptionCustomAmount.toString()
        : "",
    lastVerifiedAgainstStatement: account.lastVerifiedAgainstStatement ?? "",
    customRuleName: account.minimumPaymentCustomRule?.name ?? "Custom Card Rule",
    customRulePrincipalVariable:
      account.minimumPaymentCustomRule?.principalVariable ?? "statement_balance",
    customRuleOperationMode:
      account.minimumPaymentCustomRule?.operationMode ?? "Greater Of Flat Or Percent",
    customRulePercentageValue:
      typeof account.minimumPaymentCustomRule?.percentageValue === "number"
        ? account.minimumPaymentCustomRule.percentageValue.toString()
        : "1",
    customRuleFixedAmount:
      typeof account.minimumPaymentCustomRule?.fixedAmount === "number"
        ? account.minimumPaymentCustomRule.fixedAmount.toString()
        : "35",
    customRuleThresholdAmount:
      typeof account.minimumPaymentCustomRule?.thresholdAmount === "number"
        ? account.minimumPaymentCustomRule.thresholdAmount.toString()
        : "35",
    customRuleUseFullBalanceBelowThreshold:
      account.minimumPaymentCustomRule?.useFullBalanceBelowThreshold ?? false,
    customRuleIncludeInterestCharged:
      account.minimumPaymentCustomRule?.includeInterestCharged ?? false,
    customRuleIncludeFeesCharged: account.minimumPaymentCustomRule?.includeFeesCharged ?? false,
    customRuleIncludePastDueAmount:
      account.minimumPaymentCustomRule?.includePastDueAmount ?? false,
    customRuleIncludeLateFeeAmount:
      account.minimumPaymentCustomRule?.includeLateFeeAmount ?? false,
    customRuleIncludePromoBalance:
      account.minimumPaymentCustomRule?.includePromoBalance ?? false,
    customRuleIncludeRegularPurchaseBalance:
      account.minimumPaymentCustomRule?.includeRegularPurchaseBalance ?? false,
    customRuleIncludeCashAdvanceBalance:
      account.minimumPaymentCustomRule?.includeCashAdvanceBalance ?? false,
    lifecycleState: account.lifecycleState,
    paymentRequirement: account.paymentRequirement,
    interestAccrual: account.interestAccrual,
    isDelinquent: account.isDelinquent === true,
    notes: account.notes ?? "",
  };
}

function buildCustomRuleFromFormState(formState: DebtFormState): CreditCardCustomMinimumRule {
  return {
    name: formState.customRuleName.trim() || "Custom Card Rule",
    principalVariable: formState.customRulePrincipalVariable,
    operationMode: formState.customRuleOperationMode,
    percentageValue: parseOptionalAmount(formState.customRulePercentageValue),
    fixedAmount: parseOptionalAmount(formState.customRuleFixedAmount),
    thresholdAmount: parseOptionalAmount(formState.customRuleThresholdAmount),
    useFullBalanceBelowThreshold: formState.customRuleUseFullBalanceBelowThreshold,
    includeInterestCharged: formState.customRuleIncludeInterestCharged,
    includeFeesCharged: formState.customRuleIncludeFeesCharged,
    includePastDueAmount: formState.customRuleIncludePastDueAmount,
    includeLateFeeAmount: formState.customRuleIncludeLateFeeAmount,
    includePromoBalance: formState.customRuleIncludePromoBalance,
    includeRegularPurchaseBalance: formState.customRuleIncludeRegularPurchaseBalance,
    includeCashAdvanceBalance: formState.customRuleIncludeCashAdvanceBalance,
  };
}

function buildDraftAccountFromFormState(
  formState: DebtFormState,
  accountId: string,
): DebtAccount | null {
  const currentBalance = parseOptionalAmount(formState.currentBalance);
  if (typeof currentBalance !== "number" || currentBalance < 0) {
    return null;
  }

  const isCreditCard = formState.debtType === "Credit Card";
  return {
    id: accountId,
    providerName: formState.providerName.trim() || "Draft Card",
    issuerName: formState.issuerName.trim() || undefined,
    debtType: formState.debtType,
    currentBalance,
    originalAmount: parseOptionalAmount(formState.originalAmount),
    statementBalance: parseOptionalAmount(formState.statementBalance),
    statementMinimumDue: parseOptionalAmount(formState.statementMinimumDue),
    apr: parseOptionalAmount(formState.apr),
    creditLimit: parseOptionalAmount(formState.creditLimit),
    interestCharged: parseOptionalAmount(formState.interestCharged),
    feesCharged: parseOptionalAmount(formState.feesCharged),
    pastDueAmount: parseOptionalAmount(formState.pastDueAmount),
    daysPastDue: parseOptionalInteger(formState.daysPastDue),
    lateFeeAmount: parseOptionalAmount(formState.lateFeeAmount),
    promoType: isCreditCard ? formState.promoType : undefined,
    promoEndDate: isCreditCard ? formState.promoEndDate.trim() || undefined : undefined,
    promoBalance: parseOptionalAmount(formState.promoBalance),
    regularPurchaseBalance: parseOptionalAmount(formState.regularPurchaseBalance),
    cashAdvanceBalance: parseOptionalAmount(formState.cashAdvanceBalance),
    gracePeriodStatus: isCreditCard ? formState.gracePeriodStatus : undefined,
    termLengthMonths: parseOptionalInteger(formState.termLengthMonths),
    totalPaymentCount: parseOptionalInteger(formState.totalPaymentCount),
    completedPaymentCount: parseOptionalInteger(formState.completedPaymentCount),
    paymentCadence: formState.paymentCadence,
    nextDueDate: formState.nextDueDate.trim() || undefined,
    minimumPayment: parseOptionalAmount(formState.minimumPayment),
    scheduledPaymentAmount: isCreditCard
      ? undefined
      : parseOptionalAmount(formState.scheduledPaymentAmount),
    minimumPaymentMode: isCreditCard ? formState.minimumPaymentMode : undefined,
    minimumPaymentPresetId: isCreditCard ? formState.minimumPaymentPresetId : undefined,
    minimumPaymentCustomRule: isCreditCard ? buildCustomRuleFromFormState(formState) : undefined,
    paymentAssumptionMode: isCreditCard ? formState.paymentAssumptionMode : undefined,
    paymentAssumptionCustomAmount: isCreditCard
      ? parseOptionalAmount(formState.paymentAssumptionCustomAmount)
      : undefined,
    lastVerifiedAgainstStatement: isCreditCard
      ? formState.lastVerifiedAgainstStatement.trim() || undefined
      : undefined,
    lifecycleState: formState.lifecycleState,
    paymentRequirement: formState.paymentRequirement,
    interestAccrual: formState.interestAccrual,
    isDelinquent: formState.isDelinquent,
    notes: formState.notes.trim() || undefined,
  };
}

function renderTrustNotes(metrics: DebtDerivedMetrics) {
  if (metrics.trustNotes.length === 0) {
    return (
      <p className="text-xs text-slate-600">
        Debt math is grounded in your entered balance, due date, and payment structure.
      </p>
    );
  }

  return (
    <ul className="space-y-1 text-xs leading-relaxed text-slate-600">
      {metrics.trustNotes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

function renderTrustStateBadge(state: DebtMathTrustState) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${trustStateClasses[state]}`}
    >
      {state}
    </span>
  );
}

function renderValidationStateBadge(state: CreditCardRuleValidationState) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${validationStateClasses[state]}`}
    >
      {state}
    </span>
  );
}

function renderMatchStatusBadge(matchStatus?: string) {
  if (!matchStatus) {
    return null;
  }

  const classes =
    matchStatus === "Exact Match"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : matchStatus === "Close Match"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}>
      {matchStatus}
    </span>
  );
}

function renderInspectableItems(items: DebtMathInspectableItem[]) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {item.label}
            </p>
            {renderTrustStateBadge(item.state)}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
          {item.note ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.note}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function getFactualFlagClasses(flag: DebtFactualFlag): string {
  if (
    flag.type === "Delinquent" ||
    flag.type === "Past Due / Behind" ||
    flag.type === "Closed With Balance"
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (
    flag.type === "Promo Expiring Soon" ||
    flag.type === "High Utilization" ||
    flag.type === "Timing Cluster Forming" ||
    flag.type === "Missing Key Inputs Limiting Reliability"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (
    flag.type === "Interest Accruing" ||
    flag.type === "Interest Accruing While No Payment Required"
  ) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function renderFactualFlags(flags: DebtFactualFlag[]) {
  if (flags.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No additional short-term debt flags are active from the current account truth.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {flags.map((flag) => (
          <span
            key={flag.id}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getFactualFlagClasses(
              flag,
            )}`}
          >
            {flag.label}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        {flags.map((flag) => (
          <div key={`${flag.id}-detail`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">{flag.label}</p>
            {flag.detail ? (
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{flag.detail}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderCashWindows(cashWindows: DebtCashWindow[]) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cashWindows.map((window) => (
        <div key={window.windowDays} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Next {window.windowDays} Days
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-950">
            {formatCurrency(window.requiredPaymentTotal)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {window.dueCount === 0
              ? "No required debt payments in this window."
              : `${window.dueCount} required payment${window.dueCount === 1 ? "" : "s"}${window.nextDueDate ? ` • next ${formatDate(window.nextDueDate)}` : ""}`}
          </p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Minimum Cash To Stay Current
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatCurrency(window.minimumCashNeededToStayCurrent)}
            </p>
          </div>
          {window.timingPressureNote ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{window.timingPressureNote}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function renderConsequences(consequences: DebtConsequenceItem[]) {
  if (consequences.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No additional consequence detail is currently supported from the entered account truth.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {consequences.map((item) => (
        <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function formatMonthsSaved(value: number | undefined): string {
  if (typeof value !== "number" || value <= 0) {
    return "No time saved";
  }

  const rounded = Math.round(value * 10) / 10;
  return rounded === 1 ? "1 month saved" : `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)} months saved`;
}

export function DebtSection({
  accounts,
  bills,
  summary,
  downstreamSnapshot,
  focusedAccountId,
  onSaveAccount,
  onDeleteAccount,
}: DebtSectionProps) {
  const [selectedDebtType, setSelectedDebtType] = useState<DebtType | "All">("All");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [showProjectionDetails, setShowProjectionDetails] = useState(false);
  const [showCardMinimumDetails, setShowCardMinimumDetails] = useState(false);
  const [formState, setFormState] = useState<DebtFormState>(defaultFormState);
  const [error, setError] = useState("");
  const creditCardPresetOptions = useMemo(() => getCreditCardPresetLibrary(), []);
  const isCreditCardForm = formState.debtType === "Credit Card";

  const visibleAccounts = useMemo(
    () =>
      accounts.filter((account) =>
        selectedDebtType === "All" ? true : account.debtType === selectedDebtType,
      ),
    [accounts, selectedDebtType],
  );

  const effectiveSelectedAccountId = useMemo(() => {
    if (
      focusedAccountId &&
      visibleAccounts.some((account) => account.id === focusedAccountId)
    ) {
      return focusedAccountId;
    }

    if (
      selectedAccountId &&
      visibleAccounts.some((account) => account.id === selectedAccountId)
    ) {
      return selectedAccountId;
    }

    return visibleAccounts[0]?.id ?? "";
  }, [focusedAccountId, selectedAccountId, visibleAccounts]);

  const selectedAccount = useMemo(() => {
    if (editingAccountId) {
      return accounts.find((account) => account.id === editingAccountId) ?? null;
    }

    const preferred =
      accounts.find((account) => account.id === effectiveSelectedAccountId) ??
      visibleAccounts[0] ??
      null;
    return preferred;
  }, [accounts, editingAccountId, effectiveSelectedAccountId, visibleAccounts]);

  const selectedMetrics = useMemo(
    () => (selectedAccount ? calculateDebtDerivedMetrics(selectedAccount, bills) : null),
    [bills, selectedAccount],
  );
  const selectedSchedule = useMemo<DebtScheduleItem[]>(
    () => (selectedAccount ? getDebtSchedule(selectedAccount, bills) : []),
    [bills, selectedAccount],
  );
  const selectedDownstreamFact = useMemo<DebtDownstreamAccountFact | null>(
    () =>
      selectedAccount
        ? downstreamSnapshot.accountFacts.find(
            (fact) => fact.accountId === selectedAccount.id,
          ) ?? null
        : null,
    [downstreamSnapshot.accountFacts, selectedAccount],
  );
  const draftCreditCardAccount = useMemo(() => {
    if (!isCreditCardForm) {
      return null;
    }

    return buildDraftAccountFromFormState(formState, editingAccountId ?? "draft-credit-card");
  }, [editingAccountId, formState, isCreditCardForm]);
  const creditCardFormPreview = useMemo(
    () =>
      draftCreditCardAccount?.debtType === "Credit Card"
        ? buildCreditCardMinimumSystem(draftCreditCardAccount)
        : null,
    [draftCreditCardAccount],
  );
  const draftCreditCardMetrics = useMemo(
    () =>
      draftCreditCardAccount?.debtType === "Credit Card"
        ? calculateDebtDerivedMetrics(draftCreditCardAccount, bills)
        : null,
    [bills, draftCreditCardAccount],
  );

  function updateField<Key extends keyof DebtFormState>(key: Key, value: DebtFormState[Key]) {
    setFormState((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function resetForm() {
    setEditingAccountId(null);
    setFormState(defaultFormState);
    setError("");
    setShowCardMinimumDetails(false);
  }

  function startEditingAccount(account: DebtAccount) {
    setEditingAccountId(account.id);
    setFormState(buildFormState(account));
    setError("");
    setShowCardMinimumDetails(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.providerName.trim()) {
      setError("Provider name is required.");
      return;
    }

    const draftAccount = buildDraftAccountFromFormState(
      formState,
      editingAccountId ?? createDebtId(),
    );
    if (!draftAccount) {
      setError("Current balance is required.");
      return;
    }

    const accountId = draftAccount.id;
    if (draftAccount.debtType === "Credit Card") {
      const creditCardPreview = buildCreditCardMinimumSystem(draftAccount);
      if (draftAccount.minimumPaymentMode !== "Manual Minimum Amount") {
        if (creditCardPreview.validationState !== "Valid") {
          setError(
            `The active card minimum rule is ${creditCardPreview.validationState.toLowerCase()} and cannot be saved yet.`,
          );
          return;
        }
      }

      draftAccount.minimumPayment = creditCardPreview.currentMinimumPayment;
    }

    onSaveAccount(draftAccount);

    setSelectedAccountId(accountId);
    resetForm();
  }

  function handleDeleteSelectedAccount() {
    if (!selectedAccount) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete debt account "${selectedAccount.providerName}"?`,
    );
    if (!shouldDelete) {
      return;
    }

    onDeleteAccount(selectedAccount.id);
    if (editingAccountId === selectedAccount.id) {
      resetForm();
    }
  }

  return (
    <section
      id="debt-section"
      className="space-y-4 dashboard-animate-in"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Debt</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage debt accounts, debt-specific status logic, and the near-term obligations that feed Bills.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <span>Filter type</span>
          <select
            value={selectedDebtType}
            onChange={(event) => setSelectedDebtType(event.target.value as DebtType | "All")}
            className="dashboard-control h-10 rounded-xl px-3 text-sm"
          >
            <option value="All">All debt types</option>
            {DEBT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.35fr]">
        <section className="dashboard-shell dashboard-shell-strip rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                <HandCoins className="h-4 w-4 text-blue-700" />
                Debt Summary
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Debt stays account-centric here. Bills only receives the next operational obligations.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="dashboard-shell-inner rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Total Debt Balance
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {formatCurrency(summary.totalDebtBalance)}
              </p>
            </div>
            <div className="dashboard-shell-inner rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Required In 14 Days
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {formatCurrency(summary.requiredPaymentsIn14Days)}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Stay current with {formatCurrency(summary.minimumCashNeededIn14Days)} in this window.
              </p>
            </div>
            <div className="dashboard-shell-inner rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Required In 30 Days
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {formatCurrency(summary.requiredPaymentsIn30Days)}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Stay current with {formatCurrency(summary.minimumCashNeededIn30Days)} in this window.
              </p>
            </div>
            <div className="dashboard-shell-inner rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Required In 60 Days
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {formatCurrency(summary.requiredPaymentsIn60Days)}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {summary.nextDebtDueDate
                  ? `Next debt due ${formatDate(summary.nextDebtDueDate)} • stay current with ${formatCurrency(summary.minimumCashNeededIn60Days)}.`
                  : `Stay current with ${formatCurrency(summary.minimumCashNeededIn60Days)} in this window.`}
              </p>
            </div>
            <div className="dashboard-shell-inner rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Active Accounts
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {summary.activeAccountCount}
              </p>
            </div>
            <div className="dashboard-shell-inner rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Accounts Behind
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-rose-700">
                {summary.delinquentAccountCount}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {summary.noPaymentRequiredCount} account{summary.noPaymentRequiredCount === 1 ? "" : "s"} currently do not require payment.
              </p>
            </div>
            <div className="dashboard-shell-inner rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Timing Visibility
              </p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                {summary.timingClusterCount > 0 ? `${summary.timingClusterCount} due close together` : "No cluster in view"}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {summary.timingClusterNote ?? "No tight debt due-date cluster is currently visible in the next 60 days."}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Downstream Feed Readiness
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {downstreamSnapshot.nearTermObligations.length} bounded operational row
              {downstreamSnapshot.nearTermObligations.length === 1 ? "" : "s"} currently feed Bills in the next{" "}
              {downstreamSnapshot.boundedOperationalWindowDays} days.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {downstreamSnapshot.flaggedAccountCount} account
              {downstreamSnapshot.flaggedAccountCount === 1 ? "" : "s"} currently surface factual risk flags, and{" "}
              {downstreamSnapshot.limitedConfidenceAccountCount} remain limited-confidence. Bills stays operational;
              downstream consumers receive factual debt outputs, not debt-owned recommendations.
            </p>
          </div>
        </section>

        <section className="dashboard-shell dashboard-shell-strip rounded-3xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                <PlusCircle className="h-4 w-4 text-blue-700" />
                Debt Account Entry
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Enter debt truth here. Bills will only receive the next due operational rows.
              </p>
            </div>
            {editingAccountId ? (
              <button
                type="button"
                onClick={resetForm}
                className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
                Cancel Edit
              </button>
            ) : null}
          </div>

          <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
            <div className="dashboard-shell-inner grid gap-3 rounded-2xl p-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Provider / Account</span>
                <input
                  type="text"
                  value={formState.providerName}
                  onChange={(event) => updateField("providerName", event.target.value)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                  placeholder="Capital One Venture"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Debt Type</span>
                <select
                  value={formState.debtType}
                  onChange={(event) => updateField("debtType", event.target.value as DebtType)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  {DEBT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Current Balance</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.currentBalance}
                  onChange={(event) => updateField("currentBalance", event.target.value)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                  placeholder="5000.00"
                />
              </label>
              {isCreditCardForm ? (
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Issuer / Display Name</span>
                  <input
                    type="text"
                    value={formState.issuerName}
                    onChange={(event) => updateField("issuerName", event.target.value)}
                    className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    placeholder="Capital One"
                  />
                </label>
              ) : null}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Original Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.originalAmount}
                  onChange={(event) => updateField("originalAmount", event.target.value)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                  placeholder="Optional"
                />
              </label>
              {isCreditCardForm ? (
                <>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Statement Balance</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.statementBalance}
                      onChange={(event) => updateField("statementBalance", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="Latest statement balance"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Statement Minimum Entered</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.statementMinimumDue}
                      onChange={(event) => updateField("statementMinimumDue", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="From latest statement"
                    />
                  </label>
                </>
              ) : null}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">APR</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.apr}
                  onChange={(event) => updateField("apr", event.target.value)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                  placeholder="19.99"
                />
              </label>
              {isCreditCardForm ? (
                <>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Credit Limit</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.creditLimit}
                      onChange={(event) => updateField("creditLimit", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Interest Charged</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.interestCharged}
                      onChange={(event) => updateField("interestCharged", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="Latest statement"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Fees Charged</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.feesCharged}
                      onChange={(event) => updateField("feesCharged", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="Fees on statement"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Past Due Amount</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.pastDueAmount}
                      onChange={(event) => updateField("pastDueAmount", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Days Past Due</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formState.daysPastDue}
                      onChange={(event) => updateField("daysPastDue", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Late Fee Amount</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.lateFeeAmount}
                      onChange={(event) => updateField("lateFeeAmount", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Promo Balance</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.promoBalance}
                      onChange={(event) => updateField("promoBalance", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Promo Type</span>
                    <select
                      value={formState.promoType}
                      onChange={(event) => updateField("promoType", event.target.value as DebtPromoType)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    >
                      {DEBT_PROMO_TYPES.map((promoType) => (
                        <option key={promoType} value={promoType}>
                          {promoType}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Promo End Date</span>
                    <input
                      type="date"
                      value={formState.promoEndDate}
                      onChange={(event) => updateField("promoEndDate", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Regular Purchase Balance</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.regularPurchaseBalance}
                      onChange={(event) => updateField("regularPurchaseBalance", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Cash Advance Balance</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.cashAdvanceBalance}
                      onChange={(event) => updateField("cashAdvanceBalance", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Grace Period</span>
                    <select
                      value={formState.gracePeriodStatus}
                      onChange={(event) =>
                        updateField(
                          "gracePeriodStatus",
                          event.target.value as DebtGracePeriodStatus,
                        )
                      }
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    >
                      {DEBT_GRACE_PERIOD_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Term Months</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formState.termLengthMonths}
                      onChange={(event) => updateField("termLengthMonths", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Total Payments</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formState.totalPaymentCount}
                      onChange={(event) => updateField("totalPaymentCount", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Completed Payments</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formState.completedPaymentCount}
                      onChange={(event) => updateField("completedPaymentCount", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    />
                  </label>
                </>
              )}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Payment Cadence</span>
                <select
                  value={formState.paymentCadence}
                  onChange={(event) => updateField("paymentCadence", event.target.value as DebtPaymentCadence)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  {DEBT_PAYMENT_CADENCES.map((cadence) => (
                    <option key={cadence} value={cadence}>{cadence}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Next Due Date</span>
                <input
                  type="date"
                  value={formState.nextDueDate}
                  onChange={(event) => updateField("nextDueDate", event.target.value)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                />
              </label>
              {isCreditCardForm ? (
                <>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Minimum Payment Mode</span>
                    <select
                      value={formState.minimumPaymentMode}
                      onChange={(event) =>
                        updateField("minimumPaymentMode", event.target.value as CreditCardMinimumPaymentMode)
                      }
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    >
                      {CREDIT_CARD_MINIMUM_PAYMENT_MODES.map((mode) => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Payment Assumption</span>
                    <select
                      value={formState.paymentAssumptionMode}
                      onChange={(event) =>
                        updateField("paymentAssumptionMode", event.target.value as CreditCardPaymentAssumptionMode)
                      }
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    >
                      {CREDIT_CARD_PAYMENT_ASSUMPTION_MODES.map((mode) => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </label>
                  {formState.paymentAssumptionMode === "Custom Amount" ? (
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Custom Assumption Amount</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formState.paymentAssumptionCustomAmount}
                        onChange={(event) => updateField("paymentAssumptionCustomAmount", event.target.value)}
                        className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                        placeholder="Projection payment amount"
                      />
                    </label>
                  ) : null}
                  {formState.minimumPaymentMode === "Manual Minimum Amount" ? (
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Manual Minimum Amount</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formState.minimumPayment}
                        onChange={(event) => updateField("minimumPayment", event.target.value)}
                        className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                        placeholder="Less durable manual floor"
                      />
                    </label>
                  ) : null}
                </>
              ) : (
                <>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Minimum Payment</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.minimumPayment}
                      onChange={(event) => updateField("minimumPayment", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Scheduled Installment</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.scheduledPaymentAmount}
                      onChange={(event) => updateField("scheduledPaymentAmount", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    />
                  </label>
                </>
              )}
              {isCreditCardForm ? (
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Last Verified Against Statement</span>
                  <input
                    type="date"
                    value={formState.lastVerifiedAgainstStatement}
                    onChange={(event) => updateField("lastVerifiedAgainstStatement", event.target.value)}
                    className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                  />
                </label>
              ) : null}
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Lifecycle State</span>
                <select
                  value={formState.lifecycleState}
                  onChange={(event) => updateField("lifecycleState", event.target.value as DebtLifecycleState)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  {DEBT_LIFECYCLE_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Payment Requirement</span>
                <select
                  value={formState.paymentRequirement}
                  onChange={(event) => updateField("paymentRequirement", event.target.value as DebtPaymentRequirement)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  {DEBT_PAYMENT_REQUIREMENTS.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Interest Accrual</span>
                <select
                  value={formState.interestAccrual}
                  onChange={(event) => updateField("interestAccrual", event.target.value as DebtInterestAccrual)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  {DEBT_INTEREST_ACCRUAL_OPTIONS.map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 xl:col-span-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Notes</span>
                <textarea
                  value={formState.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  className="dashboard-control min-h-[88px] w-full rounded-xl px-3 py-3 text-sm"
                  placeholder="Promo terms, deferment notes, or assumptions worth preserving."
                />
              </label>
            </div>

            {isCreditCardForm && creditCardFormPreview ? (
              <div className="dashboard-shell-inner space-y-4 rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Credit card minimum system</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Keep statement balance separate from current balance, choose the active
                      minimum-payment mode, and inspect exactly how the current minimum is being
                      produced.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {renderValidationStateBadge(creditCardFormPreview.validationState)}
                    {renderTrustStateBadge(creditCardFormPreview.confidenceState)}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Current minimum
                    </p>
                    <p className="mt-1 text-xl font-semibold text-slate-950">
                      {typeof creditCardFormPreview.currentMinimumPayment === "number"
                        ? formatCurrency(creditCardFormPreview.currentMinimumPayment)
                        : "Not ready"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {creditCardFormPreview.minimumPaymentMode}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Payment assumption
                      </p>
                      {renderTrustStateBadge(creditCardFormPreview.paymentAssumptionTrustState)}
                    </div>
                    <p className="mt-1 text-xl font-semibold text-slate-950">
                      {typeof creditCardFormPreview.paymentAssumptionAmount === "number"
                        ? formatCurrency(creditCardFormPreview.paymentAssumptionAmount)
                        : "Limited"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {creditCardFormPreview.paymentAssumptionMode}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Statement comparison
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {renderMatchStatusBadge(creditCardFormPreview.statementMatchStatus)}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {typeof creditCardFormPreview.statementMinimumLastEntered === "number"
                        ? `Statement minimum ${formatCurrency(creditCardFormPreview.statementMinimumLastEntered)}`
                        : "No statement minimum entered yet"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {typeof creditCardFormPreview.statementComparisonDelta === "number"
                        ? `${creditCardFormPreview.statementComparisonDelta >= 0 ? "+" : ""}${formatCurrency(
                            creditCardFormPreview.statementComparisonDelta,
                          )} versus statement`
                        : "Enter the statement minimum to test rule fit."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Projection outcome
                      </p>
                      {draftCreditCardMetrics
                        ? renderTrustStateBadge(draftCreditCardMetrics.payoffTrustState)
                        : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {draftCreditCardMetrics?.payoffDateProjection
                        ? `Payoff ${formatDate(draftCreditCardMetrics.payoffDateProjection)}`
                        : "Payoff timing limited"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {typeof draftCreditCardMetrics?.projectedRemainingInterest === "number"
                        ? `${formatCurrency(
                            draftCreditCardMetrics.projectedRemainingInterest,
                          )} projected remaining interest`
                        : "Projection stays limited until the account has enough support detail."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Preset rule testing</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Compare a known issuer-style rule against the latest statement minimum.
                        </p>
                      </div>
                      {renderMatchStatusBadge(
                        creditCardFormPreview.selectedPresetPreview?.matchStatus,
                      )}
                    </div>

                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                        Selected preset
                      </span>
                      <select
                        value={formState.minimumPaymentPresetId}
                        onChange={(event) =>
                          updateField(
                            "minimumPaymentPresetId",
                            event.target.value as CreditCardPresetRuleId,
                          )
                        }
                        className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      >
                        {creditCardPresetOptions.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.ruleName}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {creditCardFormPreview.selectedPresetPreview?.ruleName ?? "Preset preview"}
                        </p>
                        {creditCardFormPreview.selectedPresetPreview
                          ? renderValidationStateBadge(
                              creditCardFormPreview.selectedPresetPreview.validationState,
                            )
                          : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-700">
                        {creditCardFormPreview.selectedPresetPreview?.plainEnglishExplanation}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Formula summary
                          </p>
                          <p className="mt-1 text-sm text-slate-900">
                            {creditCardFormPreview.selectedPresetPreview?.formulaSummary}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Calculated result
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {typeof creditCardFormPreview.selectedPresetPreview
                              ?.calculatedMinimumPayment === "number"
                              ? formatCurrency(
                                  creditCardFormPreview.selectedPresetPreview
                                    .calculatedMinimumPayment,
                                )
                              : "Missing inputs"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateField("minimumPaymentMode", "Preset Rule")}
                        className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        Use This Rule
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const currentIndex = creditCardPresetOptions.findIndex(
                            (preset) => preset.id === formState.minimumPaymentPresetId,
                          );
                          const nextPreset =
                            creditCardPresetOptions[
                              (currentIndex + 1) % creditCardPresetOptions.length
                            ];
                          updateField("minimumPaymentPresetId", nextPreset.id);
                        }}
                        className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Try Another Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField("minimumPaymentMode", "Custom Rule")}
                        className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Switch to Custom Rule
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField("minimumPaymentMode", "Manual Minimum Amount")}
                        className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                      >
                        Use Manual Minimum For Now
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Preview, validation, and save gate</p>
                      <p className="mt-1 text-xs text-slate-600">
                        The active minimum-payment mode is what will be saved. Broken or missing
                        rules cannot become the active system.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {renderValidationStateBadge(creditCardFormPreview.validationState)}
                      {renderTrustStateBadge(creditCardFormPreview.confidenceState)}
                      {renderMatchStatusBadge(creditCardFormPreview.statementMatchStatus)}
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Active rule
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {creditCardFormPreview.activeRuleName}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {creditCardFormPreview.activeRuleExplanation}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Plain-English formula summary
                        </p>
                        <p className="mt-1 text-sm text-slate-900">
                          {creditCardFormPreview.activeFormulaSummary}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Formula expression
                        </p>
                        <p className="mt-1 break-words text-sm text-slate-700">
                          {creditCardFormPreview.activeFormulaExpression}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Calculated minimum
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {typeof creditCardFormPreview.currentMinimumPayment === "number"
                              ? formatCurrency(creditCardFormPreview.currentMinimumPayment)
                              : "Missing inputs"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Statement comparison
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {typeof creditCardFormPreview.statementMinimumLastEntered === "number"
                              ? formatCurrency(creditCardFormPreview.statementMinimumLastEntered)
                              : "Statement minimum missing"}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {typeof creditCardFormPreview.statementComparisonDelta === "number"
                              ? `${creditCardFormPreview.statementComparisonDelta >= 0 ? "+" : ""}${formatCurrency(
                                  creditCardFormPreview.statementComparisonDelta,
                                )} from current calculation`
                              : "Comparison activates once a statement minimum is entered."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {creditCardFormPreview.missingDataWarnings.length > 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                          Missing data warnings
                        </p>
                        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-amber-900">
                          {creditCardFormPreview.missingDataWarnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>

                {formState.minimumPaymentMode === "Custom Rule" ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Custom rule builder</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Guided builder only. No raw scripting. Build a rule from balance inputs,
                          operation mode, threshold behavior, and included components.
                        </p>
                      </div>
                      {creditCardFormPreview.customRulePreview
                        ? renderValidationStateBadge(
                            creditCardFormPreview.customRulePreview.validationState,
                          )
                        : null}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <label className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                          Rule name
                        </span>
                        <input
                          type="text"
                          value={formState.customRuleName}
                          onChange={(event) => updateField("customRuleName", event.target.value)}
                          className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                          Balance base
                        </span>
                        <select
                          value={formState.customRulePrincipalVariable}
                          onChange={(event) =>
                            updateField(
                              "customRulePrincipalVariable",
                              event.target.value as CreditCardCustomMinimumRule["principalVariable"],
                            )
                          }
                          className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                        >
                          {creditCardRuleVariableOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                          Operation mode
                        </span>
                        <select
                          value={formState.customRuleOperationMode}
                          onChange={(event) =>
                            updateField(
                              "customRuleOperationMode",
                              event.target.value as CreditCardCustomRuleOperationMode,
                            )
                          }
                          className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                        >
                          {CREDIT_CARD_CUSTOM_RULE_OPERATION_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </label>
                      {operationNeedsPercent(formState.customRuleOperationMode) ? (
                        <label className="space-y-1.5">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                            Percentage value
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formState.customRulePercentageValue}
                            onChange={(event) =>
                              updateField("customRulePercentageValue", event.target.value)
                            }
                            className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                            placeholder="1.00"
                          />
                        </label>
                      ) : null}
                      {operationNeedsFlat(formState.customRuleOperationMode) ? (
                        <label className="space-y-1.5">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                            Fixed amount
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formState.customRuleFixedAmount}
                            onChange={(event) =>
                              updateField("customRuleFixedAmount", event.target.value)
                            }
                            className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                            placeholder="35.00"
                          />
                        </label>
                      ) : null}
                      <label className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                          Threshold amount
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formState.customRuleThresholdAmount}
                          onChange={(event) =>
                            updateField("customRuleThresholdAmount", event.target.value)
                          }
                          className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                          placeholder="Optional"
                        />
                      </label>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 md:col-span-2 xl:col-span-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Operation behavior
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {customRuleOperationDescriptions[formState.customRuleOperationMode]}
                        </p>
                        <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={formState.customRuleUseFullBalanceBelowThreshold}
                            onChange={(event) =>
                              updateField(
                                "customRuleUseFullBalanceBelowThreshold",
                                event.target.checked,
                              )
                            }
                            className="h-4 w-4 rounded border-slate-300 text-blue-700"
                          />
                          If balance is below threshold, use the full selected balance instead.
                        </label>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["customRuleIncludeInterestCharged", "Include interest charged"],
                        ["customRuleIncludeFeesCharged", "Include fees charged"],
                        ["customRuleIncludePastDueAmount", "Include past due amount"],
                        ["customRuleIncludeLateFeeAmount", "Include late fee amount"],
                        ["customRuleIncludePromoBalance", "Include promo balance"],
                        [
                          "customRuleIncludeRegularPurchaseBalance",
                          "Include regular purchase balance",
                        ],
                        ["customRuleIncludeCashAdvanceBalance", "Include cash advance balance"],
                      ].map(([key, label]) => (
                        <label
                          key={key}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(
                              formState[
                                key as keyof Pick<
                                  DebtFormState,
                                  | "customRuleIncludeInterestCharged"
                                  | "customRuleIncludeFeesCharged"
                                  | "customRuleIncludePastDueAmount"
                                  | "customRuleIncludeLateFeeAmount"
                                  | "customRuleIncludePromoBalance"
                                  | "customRuleIncludeRegularPurchaseBalance"
                                  | "customRuleIncludeCashAdvanceBalance"
                                >
                              ],
                            )}
                            onChange={(event) =>
                              updateField(
                                key as keyof DebtFormState,
                                event.target.checked as never,
                              )
                            }
                            className="h-4 w-4 rounded border-slate-300 text-blue-700"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={formState.isDelinquent}
                onChange={(event) => updateField("isDelinquent", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700"
              />
              Behind / delinquent
            </label>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 px-4 text-sm font-semibold text-white transition hover:from-blue-800 hover:to-indigo-800"
              >
                {editingAccountId ? <Save className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                {editingAccountId ? "Save Debt Account" : "Add Debt Account"}
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                <BadgeDollarSign className="h-4 w-4 text-blue-700" />
                Debt Accounts
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Filter by debt type and inspect the next payment, state, and burden quickly.
              </p>
            </div>
            <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {visibleAccounts.length} account{visibleAccounts.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {visibleAccounts.length === 0 ? (
              <div className="dashboard-shell-inner rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                No debt accounts match the current filter yet.
              </div>
            ) : (
              visibleAccounts.map((account) => {
                const Icon = debtTypeIcons[account.debtType];
                const metrics = calculateDebtDerivedMetrics(account, bills);
                const isSelected = selectedAccount?.id === account.id;

                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      setSelectedAccountId(account.id);
                      setEditingAccountId(null);
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-blue-400 bg-blue-50/80 shadow-[0_14px_30px_-24px_rgba(37,99,235,0.7)]"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <Icon className="h-4 w-4 text-blue-700" />
                          {account.providerName}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">{account.debtType}</p>
                      </div>
                      {account.isDelinquent ? (
                        <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          Behind
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Balance
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {formatCurrency(account.currentBalance)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Next Payment
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {metrics.nextScheduledPaymentAmount > 0
                            ? formatCurrency(metrics.nextScheduledPaymentAmount)
                            : "Limited"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600">
                          {metrics.nextScheduledPaymentDate
                            ? formatDate(metrics.nextScheduledPaymentDate)
                            : "No due date set"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
          {selectedAccount && selectedMetrics ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                    <CalendarClock className="h-4 w-4 text-blue-700" />
                    {selectedAccount.providerName}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Debt detail stays focused on account truth, payment schedule visibility, and payoff progress.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEditingAccount(selectedAccount)}
                    className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelectedAccount}
                    className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="dashboard-shell-inner rounded-2xl p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Remaining Balance</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {formatCurrency(selectedMetrics.remainingBalance)}
                  </p>
                </div>
                <div className="dashboard-shell-inner rounded-2xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      {selectedAccount.debtType === "Credit Card"
                        ? "Current Minimum Due"
                        : "Next Scheduled Payment"}
                    </p>
                    {renderTrustStateBadge(selectedMetrics.paymentAmountTrustState)}
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {selectedMetrics.nextScheduledPaymentAmount > 0
                      ? formatCurrency(selectedMetrics.nextScheduledPaymentAmount)
                      : "Limited"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {selectedMetrics.nextScheduledPaymentDate
                      ? formatDate(selectedMetrics.nextScheduledPaymentDate)
                      : "No next due date"}
                  </p>
                </div>
                <div className="dashboard-shell-inner rounded-2xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Current Payoff Date</p>
                    {renderTrustStateBadge(selectedMetrics.payoffTrustState)}
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {selectedMetrics.payoffDateProjection
                      ? formatDate(selectedMetrics.payoffDateProjection)
                      : "Limited"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {typeof selectedMetrics.remainingPaymentCount === "number"
                      ? `${selectedMetrics.remainingPaymentCount} payment${selectedMetrics.remainingPaymentCount === 1 ? "" : "s"} remaining`
                      : "Remaining count depends on stronger input detail."}
                  </p>
                </div>
                <div className="dashboard-shell-inner rounded-2xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Remaining Interest</p>
                    {renderTrustStateBadge(selectedMetrics.projectedRemainingInterestTrustState)}
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {typeof selectedMetrics.projectedRemainingInterest === "number"
                      ? formatCurrency(selectedMetrics.projectedRemainingInterest)
                      : "Limited"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {selectedMetrics.projection.methodLabel}
                  </p>
                </div>
              </div>

              <div className="dashboard-shell-inner rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Short-term debt cash windows</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Required debt cash is shown in 14 / 30 / 60 day windows. Stay-current figures include any currently recorded past-due amount.
                    </p>
                  </div>
                  {selectedMetrics.timingCluster ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                      Timing cluster visible
                    </span>
                  ) : null}
                </div>
                <div className="mt-4">{renderCashWindows(selectedMetrics.cashWindows)}</div>
              </div>

              {selectedAccount.debtType === "Credit Card" &&
              selectedMetrics.creditCardMinimumSystem ? (
                <div className="dashboard-shell-inner rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Credit card minimum system
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        This is the factual minimum-payment read for the selected account. Debt
                        stays inspectable here and does not present advisory behavior.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {renderValidationStateBadge(
                        selectedMetrics.creditCardMinimumSystem.validationState,
                      )}
                      {renderTrustStateBadge(
                        selectedMetrics.creditCardMinimumSystem.confidenceState,
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Account identity
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedMetrics.creditCardMinimumSystem.accountIdentity}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {selectedMetrics.creditCardMinimumSystem.issuerDisplayName}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Current minimum payment
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {typeof selectedMetrics.creditCardMinimumSystem.currentMinimumPayment ===
                        "number"
                          ? formatCurrency(
                              selectedMetrics.creditCardMinimumSystem.currentMinimumPayment,
                            )
                          : "Missing inputs"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {selectedMetrics.creditCardMinimumSystem.minimumPaymentMode}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Statement minimum last entered
                        </p>
                        {renderMatchStatusBadge(
                          selectedMetrics.creditCardMinimumSystem.statementMatchStatus,
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {typeof selectedMetrics.creditCardMinimumSystem
                          .statementMinimumLastEntered === "number"
                          ? formatCurrency(
                              selectedMetrics.creditCardMinimumSystem
                                .statementMinimumLastEntered,
                            )
                          : "Not entered"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {typeof selectedMetrics.creditCardMinimumSystem
                          .statementComparisonDelta === "number"
                          ? `${selectedMetrics.creditCardMinimumSystem.statementComparisonDelta >= 0 ? "+" : ""}${formatCurrency(
                              selectedMetrics.creditCardMinimumSystem
                                .statementComparisonDelta,
                            )} versus active rule`
                          : "Comparison activates after statement minimum entry."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Payment assumption
                        </p>
                        {renderTrustStateBadge(
                          selectedMetrics.creditCardMinimumSystem.paymentAssumptionTrustState,
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {typeof selectedMetrics.creditCardMinimumSystem
                          .paymentAssumptionAmount === "number"
                          ? formatCurrency(
                              selectedMetrics.creditCardMinimumSystem
                                .paymentAssumptionAmount,
                            )
                          : "Limited"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {selectedMetrics.creditCardMinimumSystem.paymentAssumptionMode}
                        {selectedMetrics.creditCardMinimumSystem.lastVerifiedAgainstStatement
                          ? ` • Verified ${formatDate(
                              selectedMetrics.creditCardMinimumSystem
                                .lastVerifiedAgainstStatement,
                            )}`
                          : " • Not yet verified against a statement"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Active rule
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedMetrics.creditCardMinimumSystem.activeRuleName}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {selectedMetrics.creditCardMinimumSystem.activeRuleExplanation}
                      </p>
                      <p className="mt-3 text-sm font-medium text-slate-900">
                        {selectedMetrics.creditCardMinimumSystem.activeFormulaSummary}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Projection tied to active assumption
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {selectedMetrics.payoffDateProjection
                          ? `Payoff ${formatDate(selectedMetrics.payoffDateProjection)}`
                          : "Payoff timing limited"}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        Using {selectedMetrics.creditCardMinimumSystem.paymentAssumptionMode.toLowerCase()} at{" "}
                        {typeof selectedMetrics.creditCardMinimumSystem.paymentAssumptionAmount ===
                        "number"
                          ? formatCurrency(
                              selectedMetrics.creditCardMinimumSystem
                                .paymentAssumptionAmount,
                            )
                          : "a limited value"}{" "}
                        with {selectedMetrics.creditCardMinimumSystem.paymentAssumptionTrustState.toLowerCase()} confidence.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCardMinimumDetails((previous) => !previous)}
                      className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      aria-expanded={showCardMinimumDetails}
                    >
                      {showCardMinimumDetails ? "Hide minimum system details" : "Show minimum system details"}
                      {showCardMinimumDetails ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {showCardMinimumDetails ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Full rule expression
                        </p>
                        <p className="mt-2 break-words text-sm text-slate-700">
                          {selectedMetrics.creditCardMinimumSystem.activeFormulaExpression}
                        </p>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Current formula inputs
                          </p>
                          <span className="text-xs font-medium text-slate-500">
                            Statement, balance, interest, fees, and past-due inputs
                          </span>
                        </div>
                        <div className="mt-2">
                          {renderInspectableItems(
                            selectedMetrics.creditCardMinimumSystem.currentFormulaInputs,
                          )}
                        </div>
                      </div>

                      {selectedMetrics.creditCardMinimumSystem.missingDataWarnings.length > 0 ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                            Missing-data warnings
                          </p>
                          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-amber-900">
                            {selectedMetrics.creditCardMinimumSystem.missingDataWarnings.map(
                              (warning) => (
                                <li key={warning}>{warning}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="dashboard-shell-inner rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-blue-700" />
                    <p className="text-sm font-semibold text-slate-900">Factual flags</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Compact, account-truth flags only. No hidden scoring or advisory ranking is used here.
                  </p>
                  <div className="mt-4">{renderFactualFlags(selectedMetrics.factualFlags)}</div>
                </div>

                <div className="dashboard-shell-inner rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-blue-700" />
                    <p className="text-sm font-semibold text-slate-900">Consequence visibility</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Consequence detail stays factual and tied to the current account truth.
                  </p>
                  <div className="mt-4">{renderConsequences(selectedMetrics.consequences)}</div>
                </div>
              </div>

              {selectedDownstreamFact ? (
                <div className="dashboard-shell-inner rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Downstream output preview
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        This is the factual debt payload shape other sections can consume
                        without Debt taking over their role.
                      </p>
                    </div>
                    {renderTrustStateBadge(selectedDownstreamFact.primaryConfidenceState)}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Bills Feed
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">
                        {selectedDownstreamFact.linkedSchedule.billCount}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {selectedDownstreamFact.linkedSchedule.firstDueDate
                          ? `Rows through ${formatDate(
                              selectedDownstreamFact.linkedSchedule.lastDueDate ??
                                selectedDownstreamFact.linkedSchedule.firstDueDate,
                            )}.`
                          : "No bounded operational rows are currently projected."}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Payment Assumption
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-950">
                        {selectedDownstreamFact.paymentAssumption.label}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {typeof selectedDownstreamFact.paymentAssumption.amount === "number"
                          ? `${formatCurrency(selectedDownstreamFact.paymentAssumption.amount)} • ${selectedDownstreamFact.paymentAssumption.trustState}`
                          : selectedDownstreamFact.paymentAssumption.trustState}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Factual Signals
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">
                        {selectedDownstreamFact.factualFlags.length}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {selectedDownstreamFact.consequences.length} consequence signal
                        {selectedDownstreamFact.consequences.length === 1 ? "" : "s"} carried
                        with the account.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Extra-Payment Read
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">
                        {selectedDownstreamFact.extraPaymentImpact.length}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Alternative payoff-date comparisons available for downstream
                        interpretation.
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-600">
                    {selectedDownstreamFact.linkedSchedule.boundaryNote}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                <div className="dashboard-shell-inner rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-blue-700" />
                    <p className="text-sm font-semibold text-slate-900">Debt Truth</p>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Lifecycle:</span> {selectedAccount.lifecycleState}
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Payment:</span> {selectedAccount.paymentRequirement}
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Interest:</span> {selectedAccount.interestAccrual}
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Cadence:</span> {selectedAccount.paymentCadence}
                    </p>
                    {selectedAccount.gracePeriodStatus ? (
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Grace period:</span> {selectedAccount.gracePeriodStatus}
                      </p>
                    ) : null}
                    {typeof selectedMetrics.utilizationPercent === "number" ? (
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Utilization:</span> {selectedMetrics.utilizationPercent.toFixed(1)}%
                      </p>
                    ) : null}
                    {typeof selectedMetrics.estimatedMonthlyInterest === "number" ? (
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Estimated monthly interest:</span> {formatCurrency(selectedMetrics.estimatedMonthlyInterest)}
                      </p>
                    ) : null}
                    {selectedMetrics.installmentProgressLabel ? (
                      <p className="text-sm text-slate-700 sm:col-span-2">
                        <span className="font-semibold text-slate-900">Installment progress:</span> {selectedMetrics.installmentProgressLabel}
                      </p>
                    ) : null}
                    {selectedAccount.promoType || selectedAccount.promoEndDate ? (
                      <p className="text-sm text-slate-700 sm:col-span-2">
                        <span className="font-semibold text-slate-900">Promo:</span>{" "}
                        {selectedAccount.promoType ?? "Promo"}
                        {selectedAccount.promoEndDate
                          ? ` through ${formatDate(selectedAccount.promoEndDate)}`
                          : " end date not recorded"}
                      </p>
                    ) : null}
                    {typeof selectedAccount.daysPastDue === "number" ? (
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Days past due:</span> {selectedAccount.daysPastDue}
                      </p>
                    ) : null}
                  </div>
                  {selectedAccount.notes ? (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {selectedAccount.notes}
                    </p>
                  ) : null}
                </div>

                <div className="dashboard-shell-inner rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Projection trust</p>
                    {renderTrustStateBadge(selectedMetrics.payoffTrustState)}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {selectedMetrics.projection.methodLabel}
                  </p>
                  {selectedMetrics.projection.limitationNote ? (
                    <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                      {selectedMetrics.projection.limitationNote}
                    </p>
                  ) : null}
                  <div className="mt-3">{renderTrustNotes(selectedMetrics)}</div>
                </div>
              </div>

              <div className="dashboard-shell-inner rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Payoff math and extra-payment impact</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Inspect the active projection inputs, static assumptions, and the effect of adding extra payment.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProjectionDetails((previous) => !previous)}
                    className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    aria-expanded={showProjectionDetails}
                  >
                    {showProjectionDetails ? "Hide details" : "Show details"}
                    {showProjectionDetails ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {showProjectionDetails ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Inputs used
                        </p>
                        <span className="text-xs font-medium text-slate-500">
                          What the current math is reading
                        </span>
                      </div>
                      <div className="mt-2">{renderInspectableItems(selectedMetrics.projection.inputs)}</div>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Active assumptions
                        </p>
                        <span className="text-xs font-medium text-slate-500">
                          What is treated as stable or limited
                        </span>
                      </div>
                      <div className="mt-2">{renderInspectableItems(selectedMetrics.projection.assumptions)}</div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Extra-payment impact
                      </p>
                      <div className="mt-2 space-y-2">
                        {selectedMetrics.projection.scenarios.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                            Extra-payment comparison is limited until the account has enough payment and interest detail.
                          </div>
                        ) : (
                          selectedMetrics.projection.scenarios.map((scenario) => (
                            <div
                              key={scenario.id}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {scenario.label} payment
                                  </p>
                                  <p className="text-xs text-slate-600">
                                    Total recurring payment {formatCurrency(scenario.totalPaymentAmount)}
                                  </p>
                                </div>
                                {renderTrustStateBadge(scenario.trustState)}
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    Payoff date
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {scenario.payoffDate ? formatDate(scenario.payoffDate) : "Limited"}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    Time saved
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {formatMonthsSaved(scenario.monthsSaved)}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    Interest saved
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {typeof scenario.projectedInterestSaved === "number"
                                      ? formatCurrency(scenario.projectedInterestSaved)
                                      : "Limited"}
                                  </p>
                                </div>
                              </div>
                              {scenario.note ? (
                                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                                  {scenario.note}
                                </p>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="dashboard-shell-inner rounded-2xl p-4">
                <p className="text-sm font-semibold text-slate-900">Debt-linked schedule in Bills</p>
                <p className="mt-1 text-xs text-slate-600">
                  Only near-term obligations are projected into Bills. Debt stays the owner of account structure and debt math.
                </p>
                <div className="mt-3 space-y-2">
                  {selectedSchedule.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-600">
                      No debt-linked operational rows are currently projected for this account.
                    </div>
                  ) : (
                    selectedSchedule.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatDate(item.dueDate)}
                          </p>
                          <p className="text-xs text-slate-600">{item.status}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(item.amount)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              Add a debt account to start building the debt workspace.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
