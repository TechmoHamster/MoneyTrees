"use client";

import {
  BadgeDollarSign,
  Car,
  ChevronDown,
  ChevronUp,
  CreditCard,
  GraduationCap,
  HandCoins,
  Info,
  PiggyBank,
  PlusCircle,
  ReceiptText,
  Save,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function renderSupportLabelBadge(label: string) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
      {label}
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

type DebtInternalView = "briefing" | "accounts" | "add" | "activity" | "reports" | "settings";
type DebtDetailTab = "overview" | "payments" | "payoff" | "details" | "settings";
type DebtFormStepId = "type" | "basic" | "payments" | "interest" | "status" | "review";

type DebtWorkspaceSettings = {
  groupingMode: "type" | "status";
  hideInactiveAccounts: boolean;
  dueSoonThresholdDays: number;
  promoEndingThresholdDays: number;
  defaultDetailTab: DebtDetailTab;
};

const DEBT_INTERNAL_VIEWS: Array<{
  id: DebtInternalView;
  label: string;
  hint: string;
  icon: typeof HandCoins;
}> = [
  {
    id: "briefing",
    label: "Briefing Hub",
    hint: "Quick-glance debt status and attention items",
    icon: HandCoins,
  },
  {
    id: "accounts",
    label: "Accounts",
    hint: "Grouped debt objects with focused detail",
    icon: WalletCards,
  },
  {
    id: "add",
    label: "Add Debt",
    hint: "Guided entry flow with progressive disclosure",
    icon: PlusCircle,
  },
  {
    id: "activity",
    label: "Activity",
    hint: "Real debt-linked payment and due activity",
    icon: ReceiptText,
  },
  {
    id: "reports",
    label: "Reports",
    hint: "Debt-local cash, trust, and exposure readouts",
    icon: BadgeDollarSign,
  },
  {
    id: "settings",
    label: "Settings",
    hint: "Debt workspace behavior and view controls",
    icon: ShieldAlert,
  },
];

const DEBT_DETAIL_TABS: Array<{ id: DebtDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "payments", label: "Payments / Transactions" },
  { id: "payoff", label: "Payoff Plan" },
  { id: "details", label: "Details" },
  { id: "settings", label: "Settings" },
];

const DEBT_FORM_STEPS: Array<{ id: DebtFormStepId; label: string; hint: string }> = [
  { id: "type", label: "Choose type", hint: "Start with the debt shape." },
  { id: "basic", label: "Basic info", hint: "Identity and balance." },
  { id: "payments", label: "Payment terms", hint: "How this debt gets paid." },
  { id: "interest", label: "Interest / promo", hint: "APR and special terms." },
  { id: "status", label: "Current status", hint: "Lifecycle, delinquency, and notes." },
  { id: "review", label: "Review & save", hint: "Inspect the saved debt truth." },
];

const debtTypeAccentClasses: Record<DebtType, { icon: string; pill: string; shell: string }> = {
  "Credit Card": {
    icon: "bg-blue-50 text-blue-700 border-blue-200",
    pill: "border-blue-200 bg-blue-50 text-blue-700",
    shell: "from-blue-50 to-indigo-50/80",
  },
  "Auto Loan": {
    icon: "bg-sky-50 text-sky-700 border-sky-200",
    pill: "border-sky-200 bg-sky-50 text-sky-700",
    shell: "from-sky-50 to-cyan-50/70",
  },
  "Student Loan": {
    icon: "bg-violet-50 text-violet-700 border-violet-200",
    pill: "border-violet-200 bg-violet-50 text-violet-700",
    shell: "from-violet-50 to-fuchsia-50/70",
  },
  "Installment Loan": {
    icon: "bg-amber-50 text-amber-800 border-amber-200",
    pill: "border-amber-200 bg-amber-50 text-amber-800",
    shell: "from-amber-50 to-orange-50/60",
  },
  BNPL: {
    icon: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
    shell: "from-emerald-50 to-teal-50/60",
  },
  "Financed Purchase": {
    icon: "bg-rose-50 text-rose-700 border-rose-200",
    pill: "border-rose-200 bg-rose-50 text-rose-700",
    shell: "from-rose-50 to-pink-50/70",
  },
};

const helpCopy = {
  paymentCadence:
    "Payment cadence controls how often the debt expects a payment. Keep it aligned with the actual statement or installment rhythm.",
  apr:
    "APR drives projected interest when the account is still accruing. If APR is missing, payoff and remaining-interest projections stay limited.",
  paymentAssumption:
    "Payment assumption tells Debt what recurring payment to use for payoff projection. It does not change the live obligation rows already feeding Bills.",
  gracePeriod:
    "Grace period tracks whether new balance can avoid interest when paid in full. Lost grace usually means ongoing purchases accrue interest immediately.",
  promoHandling:
    "Promo details help Debt explain expiring low-rate or deferred-interest windows. Leave them blank if the account has no active promo.",
  pastDueAmount:
    "Past due amount is the catch-up pressure already behind. Debt uses it in cash windows so overdue pressure is not hidden.",
  statementVsCurrent:
    "Statement balance is the billed balance used for many card minimum rules. Current balance can be higher or lower because of recent activity.",
  minimumPaymentMode:
    "Minimum payment mode controls how card minimums are derived: preset rule, custom rule, or a manually entered amount.",
  delinquent:
    "Mark this when the account is already behind. Debt uses it to surface factual risk and required catch-up cash.",
  cashWindows:
    "Required cash windows show how much debt cash is needed inside 14, 30, and 60 days to stay current without double-counting overdue rows.",
  projectedRemainingInterest:
    "Projected remaining interest is the estimated interest still ahead under the current payment assumption. It stays limited when APR or payment support is weak.",
} as const;

const defaultDebtWorkspaceSettings: DebtWorkspaceSettings = {
  groupingMode: "type",
  hideInactiveAccounts: false,
  dueSoonThresholdDays: 14,
  promoEndingThresholdDays: 30,
  defaultDetailTab: "overview",
};

function getDaysUntil(dateString?: string): number | null {
  if (!dateString) {
    return null;
  }

  const dueDate = new Date(dateString);
  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.round((startOfDueDate.getTime() - startOfToday.getTime()) / 86_400_000);
}

function getInitials(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function InfoToggleButton({
  show,
  onToggle,
}: {
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      aria-expanded={show}
    >
      <Info className="h-3.5 w-3.5" />
      {show ? "Hide Info" : "Show Info"}
      {show ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
    </button>
  );
}

function InlineHelp({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
        aria-label={label}
        aria-expanded={open}
      >
        <Info className="h-3 w-3" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute left-0 top-[calc(100%+0.4rem)] z-30 w-60 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]"
        >
          {description}
        </span>
      ) : null}
    </span>
  );
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
  const [activeView, setActiveView] = useState<DebtInternalView>("briefing");
  const [selectedDebtType, setSelectedDebtType] = useState<DebtType | "All">("All");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountDetailTab, setAccountDetailTab] = useState<DebtDetailTab>("overview");
  const [formStep, setFormStep] = useState<DebtFormStepId>("type");
  const [showProjectionDetails, setShowProjectionDetails] = useState(false);
  const [showAdvancedCardConfig, setShowAdvancedCardConfig] = useState(false);
  const [showAdvancedPromoConfig, setShowAdvancedPromoConfig] = useState(false);
  const [formState, setFormState] = useState<DebtFormState>(defaultFormState);
  const [error, setError] = useState("");
  const [workspaceSettings, setWorkspaceSettings] = useState<DebtWorkspaceSettings>(
    defaultDebtWorkspaceSettings,
  );
  const [infoState, setInfoState] = useState({
    briefing: false,
    accounts: false,
    add: true,
    activity: false,
    reports: false,
    settings: false,
    shared: false,
  });
  const creditCardPresetOptions = useMemo(() => getCreditCardPresetLibrary(), []);
  const isCreditCardForm = formState.debtType === "Credit Card";

  useEffect(() => {
    if (focusedAccountId && accounts.some((account) => account.id === focusedAccountId)) {
      const frame = window.requestAnimationFrame(() => {
        setSelectedAccountId(focusedAccountId);
        setActiveView("accounts");
      });

      return () => window.cancelAnimationFrame(frame);
    }
  }, [accounts, focusedAccountId]);

  function toggleInfo(key: keyof typeof infoState) {
    setInfoState((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  }

  function updateField<Key extends keyof DebtFormState>(key: Key, value: DebtFormState[Key]) {
    setFormState((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function resetForm() {
    setEditingAccountId(null);
    setFormState(defaultFormState);
    setFormStep("type");
    setError("");
    setShowAdvancedCardConfig(false);
    setShowAdvancedPromoConfig(false);
  }

  function handleStartAddDebt() {
    resetForm();
    setActiveView("add");
  }

  function startEditingAccount(account: DebtAccount) {
    setEditingAccountId(account.id);
    setSelectedAccountId(account.id);
    setFormState(buildFormState(account));
    setFormStep("type");
    setError("");
    setShowAdvancedCardConfig(account.debtType === "Credit Card");
    setShowAdvancedPromoConfig(
      Boolean(account.promoEndDate || account.promoBalance || account.gracePeriodStatus),
    );
    setActiveView("add");
  }

  function openAccount(accountId: string, nextTab: DebtDetailTab = "overview") {
    setSelectedAccountId(accountId);
    setEditingAccountId(null);
    setAccountDetailTab(nextTab);
    setActiveView("accounts");
  }

  const formStepIndex = DEBT_FORM_STEPS.findIndex((step) => step.id === formStep);
  const isFinalFormStep = formStep === "review";

  function goToPreviousFormStep() {
    if (formStepIndex <= 0) {
      return;
    }

    setFormStep(DEBT_FORM_STEPS[formStepIndex - 1].id);
  }

  function goToNextFormStep() {
    if (formStepIndex >= DEBT_FORM_STEPS.length - 1) {
      return;
    }

    setFormStep(DEBT_FORM_STEPS[formStepIndex + 1].id);
  }

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        if (selectedDebtType !== "All" && account.debtType !== selectedDebtType) {
          return false;
        }

        if (workspaceSettings.hideInactiveAccounts && account.lifecycleState === "Closed With Balance") {
          return false;
        }

        return true;
      }),
    [accounts, selectedDebtType, workspaceSettings.hideInactiveAccounts],
  );

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account] as const)),
    [accounts],
  );

  const metricsByAccountId = useMemo(
    () =>
      new Map(
        accounts.map((account) => [account.id, calculateDebtDerivedMetrics(account, bills)] as const),
      ),
    [accounts, bills],
  );

  const getAccountStatus = useCallback((account: DebtAccount) => {
    const metrics = metricsByAccountId.get(account.id);
    const dueInDays = getDaysUntil(account.nextDueDate);

    if (account.isDelinquent || (typeof account.pastDueAmount === "number" && account.pastDueAmount > 0)) {
      return {
        label: "Behind",
        detail:
          typeof account.pastDueAmount === "number" && account.pastDueAmount > 0
            ? `${formatCurrency(account.pastDueAmount)} catch-up recorded`
            : "Delinquency is marked on this account",
        classes: "border-rose-200 bg-rose-50 text-rose-700",
        score: 10,
      };
    }

    if (account.lifecycleState === "Closed With Balance") {
      return {
        label: "Closed / Inactive",
        detail: "Balance remains, but the account is not active.",
        classes: "border-slate-200 bg-slate-100 text-slate-700",
        score: 2,
      };
    }

    if (
      account.paymentRequirement === "No Payment Required" ||
      account.lifecycleState === "Deferment"
    ) {
      return {
        label: "Payment Paused",
        detail: "The account currently does not require payment.",
        classes: "border-amber-200 bg-amber-50 text-amber-800",
        score: 3,
      };
    }

    if (
      dueInDays !== null &&
      dueInDays >= 0 &&
      dueInDays <= workspaceSettings.dueSoonThresholdDays
    ) {
      return {
        label: "Due Soon",
        detail: account.nextDueDate
          ? `Next payment is due ${formatDate(account.nextDueDate)}.`
          : "Upcoming payment is in the near-term window.",
        classes: "border-amber-200 bg-amber-50 text-amber-800",
        score: 5,
      };
    }

    if (metrics?.timingCluster) {
      return {
        label: "Timing Cluster",
        detail: metrics.timingCluster.note,
        classes: "border-violet-200 bg-violet-50 text-violet-700",
        score: 4,
      };
    }

    return {
      label: "Active",
      detail: account.nextDueDate
        ? `Next scheduled payment ${formatDate(account.nextDueDate)}.`
        : "No next due date recorded yet.",
      classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
      score: 1,
    };
  }, [metricsByAccountId, workspaceSettings.dueSoonThresholdDays]);

  const effectiveSelectedAccountId = useMemo(() => {
    if (
      focusedAccountId &&
      filteredAccounts.some((account) => account.id === focusedAccountId)
    ) {
      return focusedAccountId;
    }

    if (
      selectedAccountId &&
      filteredAccounts.some((account) => account.id === selectedAccountId)
    ) {
      return selectedAccountId;
    }

    return filteredAccounts[0]?.id ?? accounts[0]?.id ?? "";
  }, [accounts, filteredAccounts, focusedAccountId, selectedAccountId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === effectiveSelectedAccountId) ?? null,
    [accounts, effectiveSelectedAccountId],
  );

  const selectedMetrics = useMemo(
    () => (selectedAccount ? metricsByAccountId.get(selectedAccount.id) ?? null : null),
    [metricsByAccountId, selectedAccount],
  );

  const selectedSchedule = useMemo<DebtScheduleItem[]>(
    () => (selectedAccount ? getDebtSchedule(selectedAccount, bills) : []),
    [bills, selectedAccount],
  );

  const selectedDownstreamFact = useMemo<DebtDownstreamAccountFact | null>(
    () =>
      selectedAccount
        ? downstreamSnapshot.accountFacts.find((fact) => fact.accountId === selectedAccount.id) ?? null
        : null,
    [downstreamSnapshot.accountFacts, selectedAccount],
  );

  const draftAccountPreview = useMemo(
    () => buildDraftAccountFromFormState(formState, editingAccountId ?? "draft-account-preview"),
    [editingAccountId, formState],
  );

  const draftCreditCardAccount = useMemo(
    () => (draftAccountPreview?.debtType === "Credit Card" ? draftAccountPreview : null),
    [draftAccountPreview],
  );

  const creditCardFormPreview = useMemo(
    () =>
      draftCreditCardAccount ? buildCreditCardMinimumSystem(draftCreditCardAccount) : null,
    [draftCreditCardAccount],
  );

  const draftPreviewMetrics = useMemo(
    () => (draftAccountPreview ? calculateDebtDerivedMetrics(draftAccountPreview, bills) : null),
    [bills, draftAccountPreview],
  );

  const groupedAccounts = useMemo(() => {
    const sorted = filteredAccounts
      .slice()
      .sort((left, right) => {
        const dueComparison = (left.nextDueDate ?? "9999-12-31").localeCompare(
          right.nextDueDate ?? "9999-12-31",
        );
        if (dueComparison !== 0) {
          return dueComparison;
        }
        return left.providerName.localeCompare(right.providerName);
      });

    if (workspaceSettings.groupingMode === "status") {
      const groups = [
        { label: "Behind", items: [] as DebtAccount[] },
        { label: "Due Soon", items: [] as DebtAccount[] },
        { label: "Payment Paused", items: [] as DebtAccount[] },
        { label: "Closed / Inactive", items: [] as DebtAccount[] },
        { label: "Active", items: [] as DebtAccount[] },
      ];

      sorted.forEach((account) => {
        const status = getAccountStatus(account).label;
        const target =
          groups.find((group) => group.label === status) ?? groups[groups.length - 1];
        target.items.push(account);
      });

      return groups.filter((group) => group.items.length > 0);
    }

    const groups = [
      {
        label: "Credit Cards",
        items: sorted.filter(
          (account) =>
            account.debtType === "Credit Card" && account.lifecycleState !== "Closed With Balance",
        ),
      },
      {
        label: "Loans",
        items: sorted.filter(
          (account) =>
            ["Auto Loan", "Student Loan", "Installment Loan"].includes(account.debtType) &&
            account.lifecycleState !== "Closed With Balance",
        ),
      },
      {
        label: "BNPL",
        items: sorted.filter(
          (account) => account.debtType === "BNPL" && account.lifecycleState !== "Closed With Balance",
        ),
      },
      {
        label: "Financed Purchases",
        items: sorted.filter(
          (account) =>
            account.debtType === "Financed Purchase" && account.lifecycleState !== "Closed With Balance",
        ),
      },
      {
        label: "Closed / Inactive",
        items: sorted.filter((account) => account.lifecycleState === "Closed With Balance"),
      },
    ];

    return groups.filter((group) => group.items.length > 0);
  }, [filteredAccounts, getAccountStatus, workspaceSettings.groupingMode]);

  const topAttentionAccounts = useMemo(() => {
    return downstreamSnapshot.accountFacts
      .map((fact) => {
        const account = accountsById.get(fact.accountId);
        if (!account) {
          return null;
        }

        const status = getAccountStatus(account);
        const dueInDays = getDaysUntil(fact.nextScheduledPaymentDate);
        const promoExpiring = Boolean(
          account.promoEndDate &&
            (() => {
              const days = getDaysUntil(account.promoEndDate);
              return days !== null && days >= 0 && days <= workspaceSettings.promoEndingThresholdDays;
            })(),
        );

        const score =
          status.score +
          fact.factualFlags.length * 2 +
          fact.consequences.length * 2 +
          (fact.primaryConfidenceState === "Limited" ? 2 : 0) +
          (promoExpiring ? 2 : 0) +
          (dueInDays !== null && dueInDays <= workspaceSettings.dueSoonThresholdDays ? 2 : 0);

        return {
          account,
          fact,
          status,
          score,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((left, right) => right.score - left.score || right.account.currentBalance - left.account.currentBalance)
      .slice(0, 4);
  }, [
    accountsById,
    downstreamSnapshot.accountFacts,
    getAccountStatus,
    workspaceSettings.dueSoonThresholdDays,
    workspaceSettings.promoEndingThresholdDays,
  ]);

  const factualAlerts = useMemo(() => {
    return topAttentionAccounts.flatMap(({ account, fact }) => {
      return fact.factualFlags.slice(0, 2).map((flag) => ({
        id: `${account.id}-${flag.id}`,
        accountId: account.id,
        providerName: account.providerName,
        label: flag.label,
        detail: flag.detail,
      }));
    }).slice(0, 6);
  }, [topAttentionAccounts]);

  const debtActivityRows = useMemo(() => {
    return bills
      .filter((bill) => bill.sourceDebtAccountId)
      .map((bill) => {
        const account = bill.sourceDebtAccountId
          ? accountsById.get(bill.sourceDebtAccountId)
          : undefined;
        return {
          id: bill.id,
          accountId: bill.sourceDebtAccountId ?? "",
          providerName: account?.providerName ?? bill.name,
          debtType: account?.debtType,
          label:
            bill.status === "Paid"
              ? "Payment recorded"
              : bill.status === "Past Due"
                ? "Payment overdue"
                : "Scheduled payment",
          eventDate: bill.status === "Paid" ? bill.paidDate ?? bill.dueDate : bill.dueDate,
          dueDate: bill.dueDate,
          amount: normalizeAmount(bill.amount + (bill.lateFeeAmount ?? 0)),
          status: bill.status,
          paymentMethod: bill.paymentMethod,
          paymentNote: bill.paymentNote,
          lateFeeAmount: bill.lateFeeAmount ?? 0,
        };
      })
      .sort((left, right) => right.eventDate.localeCompare(left.eventDate));
  }, [accountsById, bills]);

  const selectedAccountActivity = useMemo(
    () =>
      selectedAccount
        ? debtActivityRows.filter((row) => row.accountId === selectedAccount.id)
        : [],
    [debtActivityRows, selectedAccount],
  );

  const accountTypeReport = useMemo(() => {
    const groups = new Map<string, { count: number; balance: number }>();
    accounts.forEach((account) => {
      const label =
        account.lifecycleState === "Closed With Balance"
          ? "Closed / Inactive"
          : account.debtType === "Credit Card"
            ? "Credit Cards"
            : ["Auto Loan", "Student Loan", "Installment Loan"].includes(account.debtType)
              ? "Loans"
              : account.debtType;
      const current = groups.get(label) ?? { count: 0, balance: 0 };
      current.count += 1;
      current.balance = normalizeAmount(current.balance + account.currentBalance);
      groups.set(label, current);
    });

    return Array.from(groups.entries())
      .map(([label, value]) => ({ label, ...value }))
      .sort((left, right) => right.balance - left.balance);
  }, [accounts]);

  const payoffCoverage = useMemo(() => {
    const projected = downstreamSnapshot.accountFacts.filter((fact) => fact.payoffDateProjection);
    return {
      projectedCount: projected.length,
      limitedCount: downstreamSnapshot.accountFacts.filter(
        (fact) => fact.primaryConfidenceState === "Limited",
      ).length,
      exactCount: downstreamSnapshot.accountFacts.filter(
        (fact) => fact.primaryConfidenceState === "Exact",
      ).length,
      estimatedCount: downstreamSnapshot.accountFacts.filter(
        (fact) => fact.primaryConfidenceState === "Estimated",
      ).length,
    };
  }, [downstreamSnapshot.accountFacts]);

  const confidenceRows = useMemo(
    () =>
      (Object.entries(downstreamSnapshot.confidenceSummary) as Array<
        [DebtMathTrustState, number]
      >).filter(([, count]) => count > 0),
    [downstreamSnapshot.confidenceSummary],
  );

  const selectedAccountStatus = selectedAccount ? getAccountStatus(selectedAccount) : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.providerName.trim()) {
      setError("Provider name is required.");
      return;
    }

    const draftAccount = buildDraftAccountFromFormState(formState, editingAccountId ?? createDebtId());
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
    setAccountDetailTab(workspaceSettings.defaultDetailTab);
    setActiveView("accounts");
    resetForm();
  }

  function handleDeleteSelectedAccount() {
    if (!selectedAccount) {
      return;
    }

    const shouldDelete = window.confirm(`Delete debt account "${selectedAccount.providerName}"?`);
    if (!shouldDelete) {
      return;
    }

    onDeleteAccount(selectedAccount.id);
    if (editingAccountId === selectedAccount.id) {
      resetForm();
    }
  }

  function renderAccountIdentity(account: DebtAccount, compact = false) {
    const Icon = debtTypeIcons[account.debtType];
    const accent = debtTypeAccentClasses[account.debtType];
    return (
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex ${compact ? "h-10 w-10 text-sm" : "h-11 w-11 text-base"} items-center justify-center rounded-2xl border ${accent.icon}`}
        >
          {account.issuerName ? (
            <span className="font-semibold">{getInitials(account.issuerName)}</span>
          ) : (
            <Icon className="h-4.5 w-4.5" />
          )}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{account.providerName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {account.issuerName ? `${account.issuerName} • ${account.debtType}` : account.debtType}
          </p>
        </div>
      </div>
    );
  }

  function renderStepLabel(label: string, tooltip?: keyof typeof helpCopy) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
        {tooltip ? <InlineHelp label={label} description={helpCopy[tooltip]} /> : null}
      </span>
    );
  }

  function renderSectionIntro(
    key: keyof typeof infoState,
    title: string,
    description: string,
  ) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {infoState[key] ? (
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>
          ) : null}
        </div>
        <InfoToggleButton show={infoState[key]} onToggle={() => toggleInfo(key)} />
      </div>
    );
  }

  function renderAccountsView() {
    return (
      <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
          {renderSectionIntro(
            "accounts",
            "Accounts",
            "Debt accounts stay grouped here so list browsing and account detail are no longer competing with entry and reporting at the same time.",
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <span>Filter</span>
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
            <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {filteredAccounts.length} visible account{filteredAccounts.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {groupedAccounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                No debt accounts match the current filter.
              </div>
            ) : (
              groupedAccounts.map((group) => (
                <div key={group.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {group.label}
                    </h4>
                    <span className="text-xs text-slate-500">
                      {group.items.length} account{group.items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((account) => {
                      const metrics = metricsByAccountId.get(account.id);
                      const status = getAccountStatus(account);
                      const accent = debtTypeAccentClasses[account.debtType];
                      const isSelected = selectedAccount?.id === account.id;
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => openAccount(account.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? "border-blue-400 bg-blue-50/80 shadow-[0_16px_34px_-26px_rgba(37,99,235,0.6)]"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            {renderAccountIdentity(account, true)}
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.classes}`}>
                              {status.label}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div className={`rounded-2xl border bg-gradient-to-br px-3 py-3 ${accent.pill} ${accent.shell}`}>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Current balance
                              </p>
                              <p className="mt-1 text-lg font-semibold text-slate-950">
                                {formatCurrency(account.currentBalance)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                Next payment
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {metrics && metrics.nextScheduledPaymentAmount > 0
                                  ? formatCurrency(metrics.nextScheduledPaymentAmount)
                                  : "Limited"}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-600">
                                {account.nextDueDate ? formatDate(account.nextDueDate) : "No due date set"}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <span>{typeof account.apr === "number" ? `${account.apr.toFixed(2)}% APR` : "APR not recorded"}</span>
                            <span>{status.detail}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
          {!selectedAccount || !selectedMetrics ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              Select a debt account to open its focused detail view.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {renderAccountIdentity(selectedAccount)}
                    {selectedAccountStatus ? (
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${selectedAccountStatus.classes}`}>
                        {selectedAccountStatus.label}
                      </span>
                    ) : null}
                    {selectedDownstreamFact ? renderTrustStateBadge(selectedDownstreamFact.primaryConfidenceState) : null}
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Focused debt detail keeps the account object readable without forcing the entire Debt workspace onto the page at once.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEditingAccount(selectedAccount)}
                    className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Edit account
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

              <div className="flex flex-wrap gap-2">
                {DEBT_DETAIL_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAccountDetailTab(tab.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      accountDetailTab === tab.id
                        ? "border-blue-300 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {accountDetailTab === "overview" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="dashboard-shell-inner rounded-2xl p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Current balance</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(selectedMetrics.remainingBalance)}</p>
                    </div>
                    <div className="dashboard-shell-inner rounded-2xl p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                        {selectedAccount.debtType === "Credit Card" ? "Current minimum due" : "Next scheduled payment"}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {selectedMetrics.nextScheduledPaymentAmount > 0 ? formatCurrency(selectedMetrics.nextScheduledPaymentAmount) : "Limited"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {selectedMetrics.nextScheduledPaymentDate ? formatDate(selectedMetrics.nextScheduledPaymentDate) : "No next due date"}
                      </p>
                    </div>
                    <div className="dashboard-shell-inner rounded-2xl p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Projected Payoff Date</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {selectedMetrics.payoffDateProjection ? formatDate(selectedMetrics.payoffDateProjection) : "Limited"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {typeof selectedMetrics.remainingPaymentCount === "number"
                          ? `${selectedMetrics.remainingPaymentCount} payment${selectedMetrics.remainingPaymentCount === 1 ? "" : "s"} remaining`
                          : "Remaining count depends on stronger input detail."}
                      </p>
                    </div>
                    <div className="dashboard-shell-inner rounded-2xl p-3">
                      <div className="flex items-center gap-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Projected Remaining Interest</p>
                        <InlineHelp label="Projected remaining interest" description={helpCopy.projectedRemainingInterest} />
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {typeof selectedMetrics.projectedRemainingInterest === "number"
                          ? formatCurrency(selectedMetrics.projectedRemainingInterest)
                          : "Limited"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{selectedMetrics.projection.methodLabel}</p>
                    </div>
                  </div>

                  <div className="dashboard-shell-inner rounded-2xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-1">
                          <p className="text-sm font-semibold text-slate-900">Required cash windows</p>
                          <InlineHelp label="Required cash windows" description={helpCopy.cashWindows} />
                        </div>
                        <p className="mt-1 text-xs text-slate-600">Required debt cash is shown in 14 / 30 / 60 day windows so catch-up pressure stays visible.</p>
                      </div>
                      {selectedMetrics.timingCluster ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                          Timing cluster visible
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4">{renderCashWindows(selectedMetrics.cashWindows)}</div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="dashboard-shell-inner rounded-2xl p-4">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-blue-700" />
                        <p className="text-sm font-semibold text-slate-900">Account Signals</p>
                      </div>
                      <div className="mt-4">{renderFactualFlags(selectedMetrics.factualFlags)}</div>
                    </div>
                    <div className="dashboard-shell-inner rounded-2xl p-4">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-blue-700" />
                        <p className="text-sm font-semibold text-slate-900">Account Impact</p>
                      </div>
                      <div className="mt-4">{renderConsequences(selectedMetrics.consequences)}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {accountDetailTab === "payments" ? (
                <div className="space-y-4">
                  <div className="dashboard-shell-inner rounded-2xl p-4">
                    <p className="text-sm font-semibold text-slate-900">Payment and transaction activity</p>
                    <p className="mt-1 text-xs text-slate-600">Only real debt-linked bills and recorded payment details are shown here.</p>
                    <div className="mt-4 space-y-2">
                      {selectedAccountActivity.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                          No real activity is available for this account yet.
                        </div>
                      ) : (
                        selectedAccountActivity.map((row) => (
                          <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                              <p className="mt-1 text-xs text-slate-600">
                                {row.providerName} • {formatDate(row.eventDate)} • due {formatDate(row.dueDate)}
                              </p>
                              {row.paymentMethod || row.paymentNote ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  {[row.paymentMethod, row.paymentNote].filter(Boolean).join(" • ")}
                                </p>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900">{formatCurrency(row.amount)}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {row.lateFeeAmount > 0 ? `${formatCurrency(row.lateFeeAmount)} late fee included` : row.status}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="dashboard-shell-inner rounded-2xl p-4">
                    <p className="text-sm font-semibold text-slate-900">Debt-linked schedule in Bills</p>
                    <p className="mt-1 text-xs text-slate-600">Only bounded operational rows are projected into Bills. Debt keeps ownership of account structure and debt math.</p>
                    <div className="mt-3 space-y-2">
                      {selectedSchedule.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                          No debt-linked operational rows are currently projected for this account.
                        </div>
                      ) : (
                        selectedSchedule.map((item) => (
                          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{formatDate(item.dueDate)}</p>
                              <p className="text-xs text-slate-600">{item.status}</p>
                            </div>
                            <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {accountDetailTab === "payoff" ? (
                <div className="space-y-4">
                  <div className="dashboard-shell-inner rounded-2xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Payoff plan</p>
                        <p className="mt-1 text-xs text-slate-600">Inspect the active payoff method, its assumptions, and the compact extra-payment comparison table.</p>
                      </div>
                      {selectedDownstreamFact ? renderTrustStateBadge(selectedDownstreamFact.primaryConfidenceState) : null}
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Method</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{selectedMetrics.projection.methodLabel}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Payment assumption</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(selectedMetrics.projection.paymentAmountUsed)}</p>
                        <p className="mt-1 text-xs text-slate-600">{selectedMetrics.paymentAmountTrustState}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Projected payoff</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{selectedMetrics.payoffDateProjection ? formatDate(selectedMetrics.payoffDateProjection) : "Limited"}</p>
                      </div>
                    </div>
                    {selectedMetrics.projection.limitationNote ? (
                      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                        {selectedMetrics.projection.limitationNote}
                      </p>
                    ) : null}
                  </div>

                  <div className="dashboard-shell-inner rounded-2xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">Extra-payment comparison</p>
                      <button
                        type="button"
                        onClick={() => setShowProjectionDetails((previous) => !previous)}
                        className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        aria-expanded={showProjectionDetails}
                      >
                        {showProjectionDetails ? "Hide math details" : "Show math details"}
                        {showProjectionDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Scenario</th>
                            <th className="px-4 py-3">Total payment</th>
                            <th className="px-4 py-3">Projected payoff</th>
                            <th className="px-4 py-3">Time saved</th>
                            <th className="px-4 py-3">Interest saved</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedMetrics.projection.scenarios.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-4 text-sm text-slate-600">
                                Extra-payment comparison is limited until the account has enough payment and interest detail.
                              </td>
                            </tr>
                          ) : (
                            selectedMetrics.projection.scenarios.map((scenario) => (
                              <tr key={scenario.id}>
                                <td className="px-4 py-3 align-top">
                                  <p className="font-semibold text-slate-900">{scenario.label}</p>
                                  {scenario.note ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{scenario.note}</p> : null}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(scenario.totalPaymentAmount)}</td>
                                <td className="px-4 py-3 text-slate-700">{scenario.payoffDate ? formatDate(scenario.payoffDate) : "Limited"}</td>
                                <td className="px-4 py-3 text-slate-700">{formatMonthsSaved(scenario.monthsSaved)}</td>
                                <td className="px-4 py-3 text-slate-700">{typeof scenario.projectedInterestSaved === "number" ? formatCurrency(scenario.projectedInterestSaved) : "Limited"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {showProjectionDetails ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Inputs used</p>
                            <span className="text-xs font-medium text-slate-500">What the current math is reading</span>
                          </div>
                          <div className="mt-2">{renderInspectableItems(selectedMetrics.projection.inputs)}</div>
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Assumptions</p>
                            <span className="text-xs font-medium text-slate-500">What is treated as stable or limited</span>
                          </div>
                          <div className="mt-2">{renderInspectableItems(selectedMetrics.projection.assumptions)}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                          <p className="text-sm font-semibold text-slate-900">Trust and limitations</p>
                          <div className="mt-3">{renderTrustNotes(selectedMetrics)}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {accountDetailTab === "details" ? (
                <div className="space-y-4">
                  <div className="dashboard-shell-inner rounded-2xl p-4">
                    <p className="text-sm font-semibold text-slate-900">Account details</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Lifecycle:</span> {selectedAccount.lifecycleState}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Payment requirement:</span> {selectedAccount.paymentRequirement}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Interest accrual:</span> {selectedAccount.interestAccrual}</p>
                      <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Payment cadence:</span> {selectedAccount.paymentCadence}</p>
                      {typeof selectedAccount.apr === "number" ? <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">APR:</span> {selectedAccount.apr.toFixed(2)}%</p> : null}
                      {typeof selectedAccount.creditLimit === "number" ? <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Credit limit:</span> {formatCurrency(selectedAccount.creditLimit)}</p> : null}
                      {typeof selectedAccount.originalAmount === "number" ? <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Original amount:</span> {formatCurrency(selectedAccount.originalAmount)}</p> : null}
                      {selectedAccount.nextDueDate ? <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Next due date:</span> {formatDate(selectedAccount.nextDueDate)}</p> : null}
                      {selectedAccount.lastVerifiedAgainstStatement ? <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Last verified:</span> {formatDate(selectedAccount.lastVerifiedAgainstStatement)}</p> : null}
                      {selectedAccount.gracePeriodStatus ? <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Grace period:</span> {selectedAccount.gracePeriodStatus}</p> : null}
                      {typeof selectedAccount.daysPastDue === "number" ? <p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">Days past due:</span> {selectedAccount.daysPastDue}</p> : null}
                      {selectedMetrics.installmentProgressLabel ? <p className="text-sm text-slate-700 sm:col-span-2"><span className="font-semibold text-slate-900">Installment progress:</span> {selectedMetrics.installmentProgressLabel}</p> : null}
                      {selectedAccount.promoType || selectedAccount.promoEndDate ? (
                        <p className="text-sm text-slate-700 sm:col-span-2">
                          <span className="font-semibold text-slate-900">Promo:</span> {selectedAccount.promoType ?? "Promo"}
                          {selectedAccount.promoEndDate ? ` through ${formatDate(selectedAccount.promoEndDate)}` : " end date not recorded"}
                        </p>
                      ) : null}
                    </div>
                    {selectedAccount.notes ? <p className="mt-3 text-sm leading-relaxed text-slate-600">{selectedAccount.notes}</p> : null}
                  </div>

                  {selectedDownstreamFact ? (
                    <div className="dashboard-shell-inner rounded-2xl p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Shared Debt Summary</p>
                          {infoState.shared ? (
                            <p className="mt-1 text-xs text-slate-600">This is the factual debt summary other sections can safely consume without Debt handing over ownership.</p>
                          ) : null}
                        </div>
                        <InfoToggleButton show={infoState.shared} onToggle={() => toggleInfo("shared")} />
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Bills in view</p>
                          <p className="mt-2 text-xl font-semibold text-slate-950">{selectedDownstreamFact.linkedSchedule.billCount}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">{selectedDownstreamFact.linkedSchedule.firstDueDate ? `Rows through ${formatDate(selectedDownstreamFact.linkedSchedule.lastDueDate ?? selectedDownstreamFact.linkedSchedule.firstDueDate)}.` : "No bounded operational rows are currently projected."}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Payment assumption</p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">{selectedDownstreamFact.paymentAssumption.label}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">{typeof selectedDownstreamFact.paymentAssumption.amount === "number" ? `${formatCurrency(selectedDownstreamFact.paymentAssumption.amount)} • ${selectedDownstreamFact.paymentAssumption.trustState}` : selectedDownstreamFact.paymentAssumption.trustState}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Signals carried</p>
                          <p className="mt-2 text-xl font-semibold text-slate-950">{selectedDownstreamFact.factualFlags.length}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">{selectedDownstreamFact.consequences.length} impact item{selectedDownstreamFact.consequences.length === 1 ? "" : "s"} carried with the account.</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Extra-payment reads</p>
                          <p className="mt-2 text-xl font-semibold text-slate-950">{selectedDownstreamFact.extraPaymentImpact.length}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">Alternative payoff comparisons available for downstream interpretation.</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-slate-600">{selectedDownstreamFact.linkedSchedule.boundaryNote}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {accountDetailTab === "settings" ? (
                <div className="space-y-4">
                  <div className="dashboard-shell-inner rounded-2xl p-4">
                    <p className="text-sm font-semibold text-slate-900">Account settings and actions</p>
                    <p className="mt-1 text-xs text-slate-600">Account-specific changes still happen by editing the debt object here. Global workspace behavior stays in Debt Settings.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingAccount(selectedAccount)}
                        className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Edit account truth
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelectedAccount}
                        className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      >
                        Delete account
                      </button>
                    </div>
                  </div>
                  <div className="dashboard-shell-inner rounded-2xl p-4">
                    <p className="text-sm font-semibold text-slate-900">Bills integration boundary</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">Debt stays the owner of account structure, projections, and payment assumptions. Bills only receives the bounded operational rows inside the near-term window.</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderBriefingView() {
    return (
      <div className="space-y-5">
        <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
          {renderSectionIntro(
            "briefing",
            "Briefing Hub",
            "Debt stays account-owned here. This view is only the quick-glance debt read: balance, required cash, factual alerts, and the accounts asking for attention now.",
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="dashboard-shell-inner rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Total debt balance</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatCurrency(summary.totalDebtBalance)}</p>
            </div>
            <div className="dashboard-shell-inner rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Active accounts</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{summary.activeAccountCount}</p>
            </div>
            <div className="dashboard-shell-inner rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Behind / delinquent</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-rose-700">{summary.delinquentAccountCount}</p>
              <p className="mt-1 text-xs text-slate-600">Accounts already carrying catch-up pressure.</p>
            </div>
            <div className="dashboard-shell-inner rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Next debt payment</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{summary.nextDebtDueAmount > 0 ? formatCurrency(summary.nextDebtDueAmount) : "None queued"}</p>
              <p className="mt-1 text-xs text-slate-600">{summary.nextDebtDueDate ? formatDate(summary.nextDebtDueDate) : "No near-term debt due date is recorded."}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="dashboard-shell-inner rounded-2xl p-4">
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold text-slate-900">Required cash windows</p>
                <InlineHelp label="Required cash windows" description={helpCopy.cashWindows} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  {
                    label: "14 days",
                    total: summary.requiredPaymentsIn14Days,
                    stayCurrent: summary.minimumCashNeededIn14Days,
                  },
                  {
                    label: "30 days",
                    total: summary.requiredPaymentsIn30Days,
                    stayCurrent: summary.minimumCashNeededIn30Days,
                  },
                  {
                    label: "60 days",
                    total: summary.requiredPaymentsIn60Days,
                    stayCurrent: summary.minimumCashNeededIn60Days,
                  },
                ].map((window) => (
                  <div key={window.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">{window.label}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">{formatCurrency(window.total)}</p>
                    <p className="mt-1 text-xs text-slate-600">Stay current with {formatCurrency(window.stayCurrent)}.</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-shell-inner rounded-2xl p-4">
              <p className="text-sm font-semibold text-slate-900">Payoff progress support</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Projected payoff in view</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{payoffCoverage.projectedCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Exact / estimated</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{payoffCoverage.exactCount + payoffCoverage.estimatedCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Limited confidence</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{payoffCoverage.limitedCount}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{payoffCoverage.projectedCount} of {accounts.length} account{accounts.length === 1 ? "" : "s"} currently support a projected payoff date.</p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
            <p className="text-base font-semibold text-slate-900">High-priority factual alerts</p>
            <div className="mt-4 space-y-2">
              {factualAlerts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">No active factual alerts are being surfaced from the current debt truth.</div>
              ) : (
                factualAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => openAccount(alert.accountId)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">{alert.providerName}</p>
                    <p className="mt-1 text-sm text-slate-700">{alert.label}</p>
                    {alert.detail ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{alert.detail}</p> : null}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-semibold text-slate-900">Top debts needing attention</p>
              <button
                type="button"
                onClick={() => setActiveView("accounts")}
                className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Open Accounts
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {topAttentionAccounts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">Add debt accounts to populate the attention list.</div>
              ) : (
                topAttentionAccounts.map(({ account, fact, status }) => (
                  <article key={account.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      {renderAccountIdentity(account, true)}
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.classes}`}>{status.label}</span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(account.currentBalance)}</p>
                        <p className="mt-1 text-xs text-slate-600">{account.nextDueDate ? `Next due ${formatDate(account.nextDueDate)}` : "No next due date recorded"}</p>
                      </div>
                      <div className="text-sm text-slate-700">
                        <p>{fact.factualFlags[0]?.label ?? status.detail}</p>
                        {fact.consequences[0] ? <p className="mt-1 text-xs text-slate-500">{fact.consequences[0].label}</p> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => openAccount(account.id)}
                        className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Open detail
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderCreditCardAdvancedBuilder() {
    if (!isCreditCardForm || !creditCardFormPreview) {
      return null;
    }

    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Advanced credit-card logic</p>
            <p className="mt-1 text-xs text-slate-600">Keep the advanced minimum-payment system available, but only when card-specific entry actually needs it.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvancedCardConfig((previous) => !previous)}
            className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            aria-expanded={showAdvancedCardConfig}
          >
            {showAdvancedCardConfig ? "Hide advanced card fields" : "Show advanced card fields"}
            {showAdvancedCardConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {showAdvancedCardConfig ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5">
                {renderStepLabel("Statement balance", "statementVsCurrent")}
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
                {renderStepLabel("Statement minimum entered")}
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
              <label className="space-y-1.5">
                {renderStepLabel("Minimum payment mode", "minimumPaymentMode")}
                <select
                  value={formState.minimumPaymentMode}
                  onChange={(event) => updateField("minimumPaymentMode", event.target.value as CreditCardMinimumPaymentMode)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  {CREDIT_CARD_MINIMUM_PAYMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                {renderStepLabel("Payment assumption", "paymentAssumption")}
                <select
                  value={formState.paymentAssumptionMode}
                  onChange={(event) => updateField("paymentAssumptionMode", event.target.value as CreditCardPaymentAssumptionMode)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  {CREDIT_CARD_PAYMENT_ASSUMPTION_MODES.map((mode) => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </label>
              {formState.paymentAssumptionMode === "Custom Amount" ? (
                <label className="space-y-1.5">
                  {renderStepLabel("Custom assumption amount")}
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
                  {renderStepLabel("Manual minimum amount")}
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
              <label className="space-y-1.5">
                {renderStepLabel("Last verified against statement")}
                <input
                  type="date"
                  value={formState.lastVerifiedAgainstStatement}
                  onChange={(event) => updateField("lastVerifiedAgainstStatement", event.target.value)}
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Current minimum</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{typeof creditCardFormPreview.currentMinimumPayment === "number" ? formatCurrency(creditCardFormPreview.currentMinimumPayment) : "Not ready"}</p>
                <p className="mt-1 text-xs text-slate-600">{creditCardFormPreview.minimumPaymentMode}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Payment assumption</p>
                  {renderTrustStateBadge(creditCardFormPreview.paymentAssumptionTrustState)}
                </div>
                <p className="mt-1 text-xl font-semibold text-slate-950">{typeof creditCardFormPreview.paymentAssumptionAmount === "number" ? formatCurrency(creditCardFormPreview.paymentAssumptionAmount) : "Limited"}</p>
                <p className="mt-1 text-xs text-slate-600">{creditCardFormPreview.paymentAssumptionMode}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Preset support</p>
                  {renderSupportLabelBadge(creditCardFormPreview.activeRuleSupportLabel)}
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{creditCardFormPreview.activeRuleName}</p>
                <p className="mt-1 text-xs text-slate-600">{creditCardFormPreview.activeRuleExplanation}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Validation</p>
                  {renderValidationStateBadge(creditCardFormPreview.validationState)}
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{creditCardFormPreview.confidenceState}</p>
                <p className="mt-1 text-xs text-slate-600">{typeof creditCardFormPreview.statementComparisonDelta === "number" ? `${creditCardFormPreview.statementComparisonDelta >= 0 ? "+" : ""}${formatCurrency(creditCardFormPreview.statementComparisonDelta)} versus statement` : "Enter a statement minimum to compare against the active rule."}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Preset rule testing</p>
                  <p className="mt-1 text-xs text-slate-600">Compare a generic preset pattern against the latest entered statement minimum.</p>
                </div>
                <label className="space-y-1.5">
                  {renderStepLabel("Selected preset")}
                  <select
                    value={formState.minimumPaymentPresetId}
                    onChange={(event) => updateField("minimumPaymentPresetId", event.target.value as CreditCardPresetRuleId)}
                    className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                  >
                    {creditCardPresetOptions.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.ruleName}</option>
                    ))}
                  </select>
                </label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {creditCardFormPreview.selectedPresetPreview ? renderSupportLabelBadge(creditCardFormPreview.selectedPresetPreview.supportLabel) : null}
                    {renderMatchStatusBadge(creditCardFormPreview.selectedPresetPreview?.matchStatus)}
                    {creditCardFormPreview.selectedPresetPreview ? renderValidationStateBadge(creditCardFormPreview.selectedPresetPreview.validationState) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{creditCardFormPreview.selectedPresetPreview?.ruleName ?? "Preset preview"}</p>
                  <p className="mt-1 text-sm text-slate-700">{creditCardFormPreview.selectedPresetPreview?.plainEnglishExplanation}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{creditCardFormPreview.selectedPresetPreview?.supportDetail}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateField("minimumPaymentMode", "Preset Rule")}
                    className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    Use preset rule
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("minimumPaymentMode", "Custom Rule")}
                    className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Switch to custom rule
                  </button>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Custom rule builder</p>
                  <p className="mt-1 text-xs text-slate-600">Guided builder only. Save is blocked when the rule would obviously double count overlapping balance inputs.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1.5">
                    {renderStepLabel("Rule name")}
                    <input
                      type="text"
                      value={formState.customRuleName}
                      onChange={(event) => updateField("customRuleName", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5">
                    {renderStepLabel("Balance base")}
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
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 md:col-span-2">
                    {renderStepLabel("Operation mode")}
                    <select
                      value={formState.customRuleOperationMode}
                      onChange={(event) => updateField("customRuleOperationMode", event.target.value as CreditCardCustomRuleOperationMode)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    >
                      {CREDIT_CARD_CUSTOM_RULE_OPERATION_MODES.map((mode) => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-600">{customRuleOperationDescriptions[formState.customRuleOperationMode]}</p>
                  </label>
                  {operationNeedsPercent(formState.customRuleOperationMode) ? (
                    <label className="space-y-1.5">
                      {renderStepLabel("Percentage value")}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formState.customRulePercentageValue}
                        onChange={(event) => updateField("customRulePercentageValue", event.target.value)}
                        className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      />
                    </label>
                  ) : null}
                  {operationNeedsFlat(formState.customRuleOperationMode) ? (
                    <label className="space-y-1.5">
                      {renderStepLabel("Fixed amount")}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formState.customRuleFixedAmount}
                        onChange={(event) => updateField("customRuleFixedAmount", event.target.value)}
                        className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                      />
                    </label>
                  ) : null}
                  <label className="space-y-1.5">
                    {renderStepLabel("Threshold amount")}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formState.customRuleThresholdAmount}
                      onChange={(event) => updateField("customRuleThresholdAmount", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    />
                  </label>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ["customRuleIncludeInterestCharged", "Include interest charged"],
                    ["customRuleIncludeFeesCharged", "Include fees charged"],
                    ["customRuleIncludePastDueAmount", "Include past due amount"],
                    ["customRuleIncludeLateFeeAmount", "Include late fee amount"],
                    ["customRuleIncludePromoBalance", "Include promo balance"],
                    ["customRuleIncludeRegularPurchaseBalance", "Include regular purchase balance"],
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
                        onChange={(event) => updateField(key as keyof DebtFormState, event.target.checked as never)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-700"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                {creditCardFormPreview.customRulePreview?.overlapWarnings.length ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {renderSupportLabelBadge(creditCardFormPreview.customRulePreview.supportLabel)}
                      {renderValidationStateBadge(creditCardFormPreview.customRulePreview.validationState)}
                    </div>
                    <ul className="mt-2 space-y-1 text-xs leading-relaxed text-rose-900">
                      {creditCardFormPreview.customRulePreview.overlapWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderAddDebtView() {
    return (
      <section className="dashboard-shell rounded-3xl p-4 sm:p-6">
        {renderSectionIntro(
          "add",
          editingAccountId ? "Edit Debt" : "Add Debt",
          "Debt entry is now guided. Basic fields appear first, while advanced card logic and promo detail stay behind progressive disclosure so non-card debts are not crowded.",
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {DEBT_FORM_STEPS.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setFormStep(step.id)}
              className={`rounded-2xl border px-3 py-2 text-left transition ${
                formStep === step.id
                  ? "border-blue-300 bg-blue-600 text-white"
                  : index < formStepIndex
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Step {index + 1}</p>
              <p className="mt-1 text-sm font-semibold">{step.label}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{DEBT_FORM_STEPS[formStepIndex].label}</p>
            <p className="mt-1 text-sm text-slate-600">{DEBT_FORM_STEPS[formStepIndex].hint}</p>
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            {formStep === "type" ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {DEBT_TYPES.map((type) => {
                  const Icon = debtTypeIcons[type];
                  const accent = debtTypeAccentClasses[type];
                  const isSelected = formState.debtType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateField("debtType", type)}
                      className={`rounded-3xl border p-4 text-left transition ${isSelected ? "border-blue-400 bg-blue-50/80 shadow-[0_14px_34px_-26px_rgba(37,99,235,0.55)]" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                    >
                      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${accent.icon}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <p className="mt-4 text-base font-semibold text-slate-900">{type}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {type === "Credit Card"
                          ? "Card-specific minimum-payment logic and statement-based projections."
                          : type === "Auto Loan"
                            ? "Fixed installment debt with vehicle-specific payment structure."
                            : type === "Student Loan"
                              ? "Supports deferment and no-payment-required states cleanly."
                              : type === "BNPL"
                                ? "Installment-driven purchase debt with remaining-payment visibility."
                                : type === "Financed Purchase"
                                  ? "Purchase-based payment count and remaining obligation tracking."
                                  : "Installment debt with scheduled payment and payoff support."}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {formStep === "basic" ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1.5">
                  {renderStepLabel("Provider / account")}
                  <input
                    type="text"
                    value={formState.providerName}
                    onChange={(event) => updateField("providerName", event.target.value)}
                    className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    placeholder="Capital One Venture"
                  />
                </label>
                {isCreditCardForm ? (
                  <label className="space-y-1.5">
                    {renderStepLabel("Issuer / display name")}
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
                  {renderStepLabel("Current balance")}
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
                <label className="space-y-1.5">
                  {renderStepLabel("Original amount")}
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
                <label className="space-y-1.5 xl:col-span-2">
                  {renderStepLabel("Notes")}
                  <textarea
                    value={formState.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    className="dashboard-control min-h-[92px] w-full rounded-xl px-3 py-3 text-sm"
                    placeholder="Anything worth preserving about the account truth or payment structure."
                  />
                </label>
              </div>
            ) : null}

            {formStep === "payments" ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-1.5">
                    {renderStepLabel("Payment cadence", "paymentCadence")}
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
                    {renderStepLabel("Next due date")}
                    <input
                      type="date"
                      value={formState.nextDueDate}
                      onChange={(event) => updateField("nextDueDate", event.target.value)}
                      className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                    />
                  </label>
                  {!isCreditCardForm ? (
                    <>
                      <label className="space-y-1.5">
                        {renderStepLabel("Scheduled installment")}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formState.scheduledPaymentAmount}
                          onChange={(event) => updateField("scheduledPaymentAmount", event.target.value)}
                          className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                        />
                      </label>
                      <label className="space-y-1.5">
                        {renderStepLabel("Minimum payment")}
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
                        {renderStepLabel("Term months")}
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={formState.termLengthMonths}
                          onChange={(event) => updateField("termLengthMonths", event.target.value)}
                          className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                        />
                      </label>
                      <label className="space-y-1.5">
                        {renderStepLabel("Total payments")}
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
                        {renderStepLabel("Completed payments")}
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
                  ) : null}
                </div>

                {renderCreditCardAdvancedBuilder()}
              </div>
            ) : null}

            {formStep === "interest" ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-1.5">
                    {renderStepLabel("APR", "apr")}
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
                  <label className="space-y-1.5">
                    {renderStepLabel("Interest accrual")}
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
                  {isCreditCardForm ? (
                    <>
                      <label className="space-y-1.5">
                        {renderStepLabel("Credit limit")}
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
                        {renderStepLabel("Grace period", "gracePeriod")}
                        <select
                          value={formState.gracePeriodStatus}
                          onChange={(event) => updateField("gracePeriodStatus", event.target.value as DebtGracePeriodStatus)}
                          className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                        >
                          {DEBT_GRACE_PERIOD_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                </div>

                {isCreditCardForm ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="inline-flex items-center gap-1">
                          <p className="text-sm font-semibold text-slate-900">Promo and statement detail</p>
                          <InlineHelp label="Promo APR handling" description={helpCopy.promoHandling} />
                        </div>
                        <p className="mt-1 text-xs text-slate-600">Show these only when the account actually carries promo or statement-level detail worth storing.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedPromoConfig((previous) => !previous)}
                        className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        aria-expanded={showAdvancedPromoConfig}
                      >
                        {showAdvancedPromoConfig ? "Hide promo detail" : "Show promo detail"}
                        {showAdvancedPromoConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                    {showAdvancedPromoConfig ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <label className="space-y-1.5">
                          {renderStepLabel("Interest charged")}
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
                          {renderStepLabel("Fees charged")}
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
                          {renderStepLabel("Promo type")}
                          <select
                            value={formState.promoType}
                            onChange={(event) => updateField("promoType", event.target.value as DebtPromoType)}
                            className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                          >
                            {DEBT_PROMO_TYPES.map((promoType) => (
                              <option key={promoType} value={promoType}>{promoType}</option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1.5">
                          {renderStepLabel("Promo end date")}
                          <input
                            type="date"
                            value={formState.promoEndDate}
                            onChange={(event) => updateField("promoEndDate", event.target.value)}
                            className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                          />
                        </label>
                        <label className="space-y-1.5">
                          {renderStepLabel("Promo balance")}
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
                          {renderStepLabel("Regular purchase balance")}
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
                          {renderStepLabel("Cash advance balance")}
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
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {formStep === "status" ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1.5">
                  {renderStepLabel("Lifecycle state")}
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
                  {renderStepLabel("Payment requirement")}
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
                  {renderStepLabel("Past due amount", "pastDueAmount")}
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
                  {renderStepLabel("Days past due")}
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
                  {renderStepLabel("Late fee amount")}
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
                <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 xl:col-span-2">
                  <input
                    type="checkbox"
                    checked={formState.isDelinquent}
                    onChange={(event) => updateField("isDelinquent", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                  />
                  <span className="inline-flex items-center gap-1">
                    Behind / delinquent
                    <InlineHelp label="Behind or delinquent" description={helpCopy.delinquent} />
                  </span>
                </label>
                <label className="space-y-1.5 xl:col-span-4">
                  {renderStepLabel("Notes")}
                  <textarea
                    value={formState.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    className="dashboard-control min-h-[92px] w-full rounded-xl px-3 py-3 text-sm"
                    placeholder="Deferment, promo, payment arrangement, or context worth preserving."
                  />
                </label>
              </div>
            ) : null}

            {formStep === "review" ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Debt type</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formState.debtType}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Provider</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formState.providerName || "Not entered"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Current balance</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formState.currentBalance ? formatCurrency(Number.parseFloat(formState.currentBalance)) : "Required"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Next due date</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formState.nextDueDate ? formatDate(formState.nextDueDate) : "Not entered"}</p>
                  </div>
                </div>

                {draftPreviewMetrics ? (
                  <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className="dashboard-shell-inner rounded-2xl p-4">
                      <p className="text-sm font-semibold text-slate-900">Projection preview</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Projected payoff date</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{draftPreviewMetrics.payoffDateProjection ? formatDate(draftPreviewMetrics.payoffDateProjection) : "Limited"}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Projected remaining interest</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{typeof draftPreviewMetrics.projectedRemainingInterest === "number" ? formatCurrency(draftPreviewMetrics.projectedRemainingInterest) : "Limited"}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-slate-600">{draftPreviewMetrics.projection.methodLabel}</p>
                    </div>

                    {creditCardFormPreview ? (
                      <div className="dashboard-shell-inner rounded-2xl p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {renderValidationStateBadge(creditCardFormPreview.validationState)}
                          {renderTrustStateBadge(creditCardFormPreview.confidenceState)}
                          {renderSupportLabelBadge(creditCardFormPreview.activeRuleSupportLabel)}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-900">{creditCardFormPreview.activeRuleName}</p>
                        <p className="mt-1 text-sm text-slate-700">{creditCardFormPreview.activeRuleExplanation}</p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-600">{creditCardFormPreview.activeRuleSupportDetail}</p>
                        {creditCardFormPreview.activeRuleOverlapWarnings.length > 0 ? (
                          <ul className="mt-3 space-y-1 text-xs leading-relaxed text-rose-700">
                            {creditCardFormPreview.activeRuleOverlapWarnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Projection preview stays limited until the account has a valid current balance.
                  </div>
                )}
              </div>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <div className="text-xs text-slate-500">
                {editingAccountId ? "Editing existing debt truth" : "New debt account will save back into Debt and feed Bills only through bounded operational rows."}
              </div>
              <div className="flex flex-wrap gap-2">
                {formStepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={goToPreviousFormStep}
                    className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveView("briefing")}
                    className="dashboard-control inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Leave flow
                  </button>
                )}
                {!isFinalFormStep ? (
                  <button
                    type="button"
                    onClick={goToNextFormStep}
                    className="inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 px-4 text-sm font-semibold text-white transition hover:from-blue-800 hover:to-indigo-800"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 px-4 text-sm font-semibold text-white transition hover:from-blue-800 hover:to-indigo-800"
                  >
                    {editingAccountId ? <Save className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                    {editingAccountId ? "Save Debt Account" : "Add Debt Account"}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </section>
    );
  }

  function renderActivityView() {
    return (
      <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
        {renderSectionIntro(
          "activity",
          "Activity",
          "Debt activity only uses real debt-linked payment rows already present in the app. If there is no activity yet, Debt shows that directly instead of inventing history.",
        )}
        <div className="mt-4 space-y-3">
          {debtActivityRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              No real debt activity is available yet.
            </div>
          ) : (
            debtActivityRows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => openAccount(row.accountId, "payments")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                    <p className="mt-1 text-xs text-slate-600">{row.providerName} • {formatDate(row.eventDate)} • due {formatDate(row.dueDate)}</p>
                    {row.paymentMethod || row.paymentNote ? (
                      <p className="mt-1 text-xs text-slate-500">{[row.paymentMethod, row.paymentNote].filter(Boolean).join(" • ")}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(row.amount)}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.lateFeeAmount > 0 ? `${formatCurrency(row.lateFeeAmount)} late fee included` : row.status}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    );
  }

  function renderReportsView() {
    return (
      <div className="space-y-5">
        <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
          {renderSectionIntro(
            "reports",
            "Reports",
            "Debt-local reporting stays factual: cash requirement, debt mix, confidence support, and the bounded near-term obligations already feeding Bills.",
          )}
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="dashboard-shell-inner rounded-2xl p-4">
              <p className="text-sm font-semibold text-slate-900">Cash requirement windows</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  {
                    label: "14 days",
                    total: summary.requiredPaymentsIn14Days,
                    stayCurrent: summary.minimumCashNeededIn14Days,
                  },
                  {
                    label: "30 days",
                    total: summary.requiredPaymentsIn30Days,
                    stayCurrent: summary.minimumCashNeededIn30Days,
                  },
                  {
                    label: "60 days",
                    total: summary.requiredPaymentsIn60Days,
                    stayCurrent: summary.minimumCashNeededIn60Days,
                  },
                ].map((window) => (
                  <div key={window.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{window.label}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(window.total)}</p>
                    <p className="mt-1 text-xs text-slate-600">Stay current with {formatCurrency(window.stayCurrent)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-shell-inner rounded-2xl p-4">
              <p className="text-sm font-semibold text-slate-900">Confidence support</p>
              <div className="mt-4 space-y-3">
                {confidenceRows.length === 0 ? (
                  <p className="text-sm text-slate-600">No confidence distribution is available yet.</p>
                ) : (
                  confidenceRows.map(([state, count]) => (
                    <div key={state}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-700">{state}</span>
                        <span className="text-slate-500">{count}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div
                          className={`h-2 rounded-full ${
                            state === "Exact"
                              ? "bg-emerald-500"
                              : state === "Estimated"
                                ? "bg-blue-500"
                                : state === "Custom"
                                  ? "bg-violet-500"
                                  : state === "Manual"
                                    ? "bg-slate-500"
                                    : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.max((count / Math.max(accounts.length, 1)) * 100, 8)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
            <p className="text-base font-semibold text-slate-900">Debt mix</p>
            <div className="mt-4 space-y-3">
              {accountTypeReport.map((entry) => (
                <div key={entry.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(entry.balance)}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{entry.count} account{entry.count === 1 ? "" : "s"}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
            <p className="text-base font-semibold text-slate-900">Near-term operational obligations</p>
            <p className="mt-1 text-sm text-slate-600">These are the bounded unpaid upcoming debt rows already shared with Bills.</p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Due date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {downstreamSnapshot.nearTermObligations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-sm text-slate-600">No bounded operational debt rows are currently projected.</td>
                    </tr>
                  ) : (
                    downstreamSnapshot.nearTermObligations.map((obligation) => (
                      <tr key={obligation.billId}>
                        <td className="px-4 py-3 font-medium text-slate-900">{obligation.providerName}</td>
                        <td className="px-4 py-3 text-slate-700">{obligation.debtType}</td>
                        <td className="px-4 py-3 text-slate-700">{formatDate(obligation.dueDate)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatCurrency(obligation.amount)}</td>
                        <td className="px-4 py-3 text-slate-700">{obligation.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    );
  }

  function renderSettingsView() {
    return (
      <section className="dashboard-shell rounded-3xl p-4 sm:p-5">
        {renderSectionIntro(
          "settings",
          "Settings",
          "These controls affect the Debt workspace only. They do not rewrite debt math or alter Bills integration behavior outside the current Debt view.",
        )}
        <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="dashboard-shell-inner rounded-2xl p-4">
            <p className="text-sm font-semibold text-slate-900">Workspace behavior</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Grouping mode</span>
                <select
                  value={workspaceSettings.groupingMode}
                  onChange={(event) =>
                    setWorkspaceSettings((previous) => ({
                      ...previous,
                      groupingMode: event.target.value as DebtWorkspaceSettings["groupingMode"],
                    }))
                  }
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  <option value="type">Group by debt type</option>
                  <option value="status">Group by current status</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Default detail tab</span>
                <select
                  value={workspaceSettings.defaultDetailTab}
                  onChange={(event) =>
                    setWorkspaceSettings((previous) => ({
                      ...previous,
                      defaultDetailTab: event.target.value as DebtDetailTab,
                    }))
                  }
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                >
                  {DEBT_DETAIL_TABS.map((tab) => (
                    <option key={tab.id} value={tab.id}>{tab.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Due-soon threshold</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={workspaceSettings.dueSoonThresholdDays}
                  onChange={(event) =>
                    setWorkspaceSettings((previous) => ({
                      ...previous,
                      dueSoonThresholdDays: Number.parseInt(event.target.value || "14", 10),
                    }))
                  }
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">Promo-ending threshold</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={workspaceSettings.promoEndingThresholdDays}
                  onChange={(event) =>
                    setWorkspaceSettings((previous) => ({
                      ...previous,
                      promoEndingThresholdDays: Number.parseInt(event.target.value || "30", 10),
                    }))
                  }
                  className="dashboard-control h-11 w-full rounded-xl px-3 text-sm"
                />
              </label>
              <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  checked={workspaceSettings.hideInactiveAccounts}
                  onChange={(event) =>
                    setWorkspaceSettings((previous) => ({
                      ...previous,
                      hideInactiveAccounts: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-700"
                />
                Hide closed / inactive accounts from the working list
              </label>
            </div>
          </div>

          <div className="dashboard-shell-inner rounded-2xl p-4">
            <p className="text-sm font-semibold text-slate-900">Boundaries and identity</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>Debt currently uses a safe identity fallback system: debt-type icon plus accent color. No brittle external logo lookup is introduced here.</p>
              <p>Bills integration remains bounded. Debt still owns account structure, projection logic, and trust labeling.</p>
              <p>These settings are local to the current Debt workspace. They do not persist cross-device yet.</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="debt-section" className="dashboard-animate-in px-1">
      <div className="mx-auto max-w-[1520px] space-y-5 px-0 sm:px-1">
        <div className="dashboard-shell rounded-3xl p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Debt</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">Debt is now organized as a focused mini-app: quick briefing, grouped accounts, guided entry, real activity, debt-local reports, and workspace settings.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleStartAddDebt}
                className="inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 px-4 text-sm font-semibold text-white transition hover:from-blue-800 hover:to-indigo-800"
              >
                <PlusCircle className="h-4 w-4" />
                Add Debt
              </button>
            </div>
          </div>

          <nav className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            {DEBT_INTERNAL_VIEWS.map((view) => {
              const Icon = view.icon;
              const isActive = activeView === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setActiveView(view.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-blue-400 bg-blue-600 text-white shadow-[0_16px_34px_-26px_rgba(37,99,235,0.6)]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Icon className="h-4 w-4" />
                    {view.label}
                  </div>
                  <p className={`mt-1 text-xs leading-relaxed ${isActive ? "text-blue-100" : "text-slate-500"}`}>
                    {view.hint}
                  </p>
                </button>
              );
            })}
          </nav>
        </div>

        {activeView === "briefing" ? renderBriefingView() : null}
        {activeView === "accounts" ? renderAccountsView() : null}
        {activeView === "add" ? renderAddDebtView() : null}
        {activeView === "activity" ? renderActivityView() : null}
        {activeView === "reports" ? renderReportsView() : null}
        {activeView === "settings" ? renderSettingsView() : null}
      </div>
    </section>
  );
}
