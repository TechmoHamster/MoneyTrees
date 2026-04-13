import type {
  CreditCardCustomMinimumRule,
  CreditCardMinimumPaymentMode,
  CreditCardMinimumSystem,
  CreditCardPaymentAssumptionMode,
  CreditCardPresetRuleId,
  CreditCardRuleMatchStatus,
  CreditCardRulePreview,
  CreditCardRuleValidationState,
  CreditCardRuleVariable,
  DebtAccount,
  DebtMathInspectableItem,
  DebtMathTrustState,
} from "@/lib/types";
import { formatCurrency, normalizeAmount } from "@/lib/utils";

type CreditCardRuleVariableValues = Record<CreditCardRuleVariable, number | undefined>;

type CardRuleCalculation = {
  amount?: number;
  validationState: CreditCardRuleValidationState;
  confidenceState: DebtMathTrustState;
  formulaSummary: string;
  formulaExpression: string;
  plainEnglishExplanation: string;
  missingInputs: string[];
};

type CreditCardPresetDefinition = {
  id: CreditCardPresetRuleId;
  ruleName: string;
  plainEnglishExplanation: string;
  compute: (values: CreditCardRuleVariableValues) => CardRuleCalculation;
};

function getValueLabel(variable: CreditCardRuleVariable): string {
  switch (variable) {
    case "statement_balance":
      return "Statement balance";
    case "current_balance":
      return "Current balance";
    case "interest_charged":
      return "Interest charged";
    case "fees_charged":
      return "Fees charged";
    case "past_due_amount":
      return "Past due amount";
    case "late_fee_amount":
      return "Late fee amount";
    case "promo_balance":
      return "Promo balance";
    case "regular_purchase_balance":
      return "Regular purchase balance";
    case "cash_advance_balance":
      return "Cash advance balance";
    case "balance_subject_to_minimum":
      return "Balance subject to minimum";
  }
}

function isUsableNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getVariableValues(account: DebtAccount): CreditCardRuleVariableValues {
  const statementBalance = isUsableNumber(account.statementBalance)
    ? normalizeAmount(account.statementBalance)
    : undefined;
  const currentBalance = normalizeAmount(account.currentBalance);
  const promoBalance = isUsableNumber(account.promoBalance)
    ? normalizeAmount(account.promoBalance)
    : undefined;
  const regularPurchaseBalance = isUsableNumber(account.regularPurchaseBalance)
    ? normalizeAmount(account.regularPurchaseBalance)
    : undefined;
  const cashAdvanceBalance = isUsableNumber(account.cashAdvanceBalance)
    ? normalizeAmount(account.cashAdvanceBalance)
    : undefined;

  const inferredSubjectBalance = isUsableNumber(statementBalance)
    ? Math.max(0, normalizeAmount(statementBalance - (promoBalance ?? 0)))
    : isUsableNumber(regularPurchaseBalance) || isUsableNumber(cashAdvanceBalance)
      ? normalizeAmount((regularPurchaseBalance ?? 0) + (cashAdvanceBalance ?? 0))
      : currentBalance;

  return {
    statement_balance: statementBalance,
    current_balance: currentBalance,
    interest_charged: isUsableNumber(account.interestCharged)
      ? normalizeAmount(account.interestCharged)
      : undefined,
    fees_charged: isUsableNumber(account.feesCharged)
      ? normalizeAmount(account.feesCharged)
      : undefined,
    past_due_amount: isUsableNumber(account.pastDueAmount)
      ? normalizeAmount(account.pastDueAmount)
      : undefined,
    late_fee_amount: isUsableNumber(account.lateFeeAmount)
      ? normalizeAmount(account.lateFeeAmount)
      : undefined,
    promo_balance: promoBalance,
    regular_purchase_balance: regularPurchaseBalance,
    cash_advance_balance: cashAdvanceBalance,
    balance_subject_to_minimum: inferredSubjectBalance,
  };
}

function requireValue(
  values: CreditCardRuleVariableValues,
  key: CreditCardRuleVariable,
  missingInputs: string[],
): number {
  const value = values[key];
  if (!isUsableNumber(value)) {
    missingInputs.push(getValueLabel(key));
    return 0;
  }

  return value;
}

function clampRoundedAmount(value: number): number {
  return Math.max(0, normalizeAmount(value));
}

function resolveMatchStatus(
  calculatedAmount: number | undefined,
  statementMinimum: number | undefined,
): {
  matchStatus?: CreditCardRuleMatchStatus;
  comparisonDelta?: number;
} {
  if (!isUsableNumber(calculatedAmount) || !isUsableNumber(statementMinimum)) {
    return {};
  }

  const comparisonDelta = normalizeAmount(calculatedAmount - statementMinimum);
  const absoluteDelta = Math.abs(comparisonDelta);
  if (absoluteDelta <= 0.01) {
    return { matchStatus: "Exact Match", comparisonDelta };
  }

  if (absoluteDelta <= Math.max(2, normalizeAmount(statementMinimum * 0.05))) {
    return { matchStatus: "Close Match", comparisonDelta };
  }

  return { matchStatus: "Does Not Match", comparisonDelta };
}

const creditCardPresetLibrary: CreditCardPresetDefinition[] = [
  {
    id: "greater-of-flat-or-percent-statement",
    ruleName: "Greater of flat minimum or percent of statement balance",
    plainEnglishExplanation:
      "Uses the larger of a flat floor or a small percent of the statement balance.",
    compute(values) {
      const missingInputs: string[] = [];
      const statementBalance = requireValue(values, "statement_balance", missingInputs);
      if (missingInputs.length > 0) {
        return {
          amount: undefined,
          validationState: "Missing Required Inputs",
          confidenceState: "Limited",
          formulaSummary: "Greater of $35 or 1% of statement balance.",
          formulaExpression: "max($35, statement_balance * 1%)",
          plainEnglishExplanation:
            "Uses the larger of a $35 floor or 1% of the statement balance.",
          missingInputs,
        };
      }
      return {
        amount: clampRoundedAmount(Math.max(35, statementBalance * 0.01)),
        validationState: "Valid",
        confidenceState: "Estimated",
        formulaSummary: "Greater of $35 or 1% of statement balance.",
        formulaExpression: "max($35, statement_balance * 1%)",
        plainEnglishExplanation:
          "Uses the larger of a $35 floor or 1% of the statement balance.",
        missingInputs,
      };
    },
  },
  {
    id: "interest-fees-plus-percent-principal",
    ruleName: "Interest + fees + percent of principal",
    plainEnglishExplanation:
      "Adds current interest and fees to 1% of the balance subject to minimum.",
    compute(values) {
      const missingInputs: string[] = [];
      const principal = requireValue(values, "balance_subject_to_minimum", missingInputs);
      const interest = requireValue(values, "interest_charged", missingInputs);
      const fees = requireValue(values, "fees_charged", missingInputs);
      if (missingInputs.length > 0) {
        return {
          amount: undefined,
          validationState: "Missing Required Inputs",
          confidenceState: "Limited",
          formulaSummary: "1% of principal balance + interest + fees.",
          formulaExpression:
            "(balance_subject_to_minimum * 1%) + interest_charged + fees_charged",
          plainEnglishExplanation:
            "Adds current interest and fees to 1% of the balance subject to minimum.",
          missingInputs,
        };
      }
      return {
        amount: clampRoundedAmount(principal * 0.01 + interest + fees),
        validationState: "Valid",
        confidenceState: "Estimated",
        formulaSummary: "1% of principal balance + interest + fees.",
        formulaExpression:
          "(balance_subject_to_minimum * 1%) + interest_charged + fees_charged",
        plainEnglishExplanation:
          "Adds current interest and fees to 1% of the balance subject to minimum.",
        missingInputs,
      };
    },
  },
  {
    id: "percent-of-statement-balance",
    ruleName: "Percent of statement balance",
    plainEnglishExplanation:
      "Calculates the minimum as 2% of the statement balance only.",
    compute(values) {
      const missingInputs: string[] = [];
      const statementBalance = requireValue(values, "statement_balance", missingInputs);
      if (missingInputs.length > 0) {
        return {
          amount: undefined,
          validationState: "Missing Required Inputs",
          confidenceState: "Limited",
          formulaSummary: "2% of statement balance.",
          formulaExpression: "statement_balance * 2%",
          plainEnglishExplanation:
            "Calculates the minimum as 2% of the statement balance only.",
          missingInputs,
        };
      }
      return {
        amount: clampRoundedAmount(statementBalance * 0.02),
        validationState: "Valid",
        confidenceState: "Estimated",
        formulaSummary: "2% of statement balance.",
        formulaExpression: "statement_balance * 2%",
        plainEnglishExplanation:
          "Calculates the minimum as 2% of the statement balance only.",
        missingInputs,
      };
    },
  },
  {
    id: "percent-of-current-balance",
    ruleName: "Percent of current balance",
    plainEnglishExplanation:
      "Calculates the minimum as 2% of the current balance.",
    compute(values) {
      const currentBalance = values.current_balance ?? 0;
      return {
        amount: clampRoundedAmount(currentBalance * 0.02),
        validationState: "Valid",
        confidenceState: "Estimated",
        formulaSummary: "2% of current balance.",
        formulaExpression: "current_balance * 2%",
        plainEnglishExplanation:
          "Calculates the minimum as 2% of the current balance.",
        missingInputs: [],
      };
    },
  },
  {
    id: "full-balance-below-threshold",
    ruleName: "Full balance if balance is below threshold",
    plainEnglishExplanation:
      "Pays the full statement when it is small; otherwise falls back to a flat $35 minimum.",
    compute(values) {
      const missingInputs: string[] = [];
      const statementBalance = requireValue(values, "statement_balance", missingInputs);
      if (missingInputs.length > 0) {
        return {
          amount: undefined,
          validationState: "Missing Required Inputs",
          confidenceState: "Limited",
          formulaSummary: "If statement balance <= $35, use full balance; otherwise use $35.",
          formulaExpression: "statement_balance <= $35 ? statement_balance : $35",
          plainEnglishExplanation:
            "Pays the full statement when it is small; otherwise uses a $35 floor.",
          missingInputs,
        };
      }
      return {
        amount: clampRoundedAmount(statementBalance <= 35 ? statementBalance : 35),
        validationState: "Valid",
        confidenceState: "Estimated",
        formulaSummary: "If statement balance <= $35, use full balance; otherwise use $35.",
        formulaExpression: "statement_balance <= $35 ? statement_balance : $35",
        plainEnglishExplanation:
          "Pays the full statement when it is small; otherwise uses a $35 floor.",
        missingInputs,
      };
    },
  },
  {
    id: "flat-minimum-unless-smaller",
    ruleName: "Flat minimum unless full balance is smaller",
    plainEnglishExplanation:
      "Uses a $35 floor unless the full statement balance is smaller.",
    compute(values) {
      const missingInputs: string[] = [];
      const statementBalance = requireValue(values, "statement_balance", missingInputs);
      if (missingInputs.length > 0) {
        return {
          amount: undefined,
          validationState: "Missing Required Inputs",
          confidenceState: "Limited",
          formulaSummary: "Minimum of $35 or the full statement balance.",
          formulaExpression: "min($35, statement_balance)",
          plainEnglishExplanation:
            "Uses a $35 floor unless the statement balance is smaller.",
          missingInputs,
        };
      }
      return {
        amount: clampRoundedAmount(Math.min(35, statementBalance)),
        validationState: "Valid",
        confidenceState: "Estimated",
        formulaSummary: "Minimum of $35 or the full statement balance.",
        formulaExpression: "min($35, statement_balance)",
        plainEnglishExplanation:
          "Uses a $35 floor unless the statement balance is smaller.",
        missingInputs,
      };
    },
  },
  {
    id: "flat-minimum-plus-past-due",
    ruleName: "Flat minimum + past due amount",
    plainEnglishExplanation:
      "Adds the current past-due amount on top of a flat minimum floor.",
    compute(values) {
      const pastDueAmount = values.past_due_amount ?? 0;
      return {
        amount: clampRoundedAmount(35 + pastDueAmount),
        validationState: "Valid",
        confidenceState: "Estimated",
        formulaSummary: "$35 floor plus past due amount.",
        formulaExpression: "$35 + past_due_amount",
        plainEnglishExplanation:
          "Adds the current past-due amount on top of a $35 minimum floor.",
        missingInputs: [],
      };
    },
  },
  {
    id: "percent-plus-interest-fees-past-due",
    ruleName: "Percent of balance + interest + fees + past due",
    plainEnglishExplanation:
      "Uses 1% of statement balance, then adds current interest, fees, and any past due amount.",
    compute(values) {
      const missingInputs: string[] = [];
      const statementBalance = requireValue(values, "statement_balance", missingInputs);
      const interest = requireValue(values, "interest_charged", missingInputs);
      const fees = requireValue(values, "fees_charged", missingInputs);
      const pastDueAmount = requireValue(values, "past_due_amount", missingInputs);
      if (missingInputs.length > 0) {
        return {
          amount: undefined,
          validationState: "Missing Required Inputs",
          confidenceState: "Limited",
          formulaSummary: "1% of statement balance + interest + fees + past due amount.",
          formulaExpression:
            "(statement_balance * 1%) + interest_charged + fees_charged + past_due_amount",
          plainEnglishExplanation:
            "Uses 1% of statement balance, then adds current interest, fees, and any past due amount.",
          missingInputs,
        };
      }
      return {
        amount: clampRoundedAmount(statementBalance * 0.01 + interest + fees + pastDueAmount),
        validationState: "Valid",
        confidenceState: "Estimated",
        formulaSummary: "1% of statement balance + interest + fees + past due amount.",
        formulaExpression:
          "(statement_balance * 1%) + interest_charged + fees_charged + past_due_amount",
        plainEnglishExplanation:
          "Uses 1% of statement balance, then adds current interest, fees, and any past due amount.",
        missingInputs,
      };
    },
  },
];

export function getCreditCardPresetLibrary(): Array<{
  id: CreditCardPresetRuleId;
  ruleName: string;
}> {
  return creditCardPresetLibrary.map((preset) => ({
    id: preset.id,
    ruleName: preset.ruleName,
  }));
}

function buildManualMinimumPreview(account: DebtAccount): CreditCardRulePreview {
  const manualAmount =
    typeof account.minimumPayment === "number" && account.minimumPayment > 0
      ? normalizeAmount(account.minimumPayment)
      : typeof account.statementMinimumDue === "number" && account.statementMinimumDue > 0
        ? normalizeAmount(account.statementMinimumDue)
        : undefined;
  const validationState: CreditCardRuleValidationState = isUsableNumber(manualAmount)
    ? "Valid"
    : "Missing Required Inputs";
  const confidenceState: DebtMathTrustState = isUsableNumber(manualAmount)
    ? "Manual"
    : "Limited";
  const match = resolveMatchStatus(manualAmount, account.statementMinimumDue);

  return {
    id: "manual-minimum",
    ruleName: "Manual minimum amount",
    plainEnglishExplanation:
      "Uses the manually entered minimum amount instead of a preset or custom formula.",
    formulaSummary: isUsableNumber(manualAmount)
      ? `Manual minimum due set to ${formatCurrency(manualAmount)}.`
      : "Manual minimum due is missing.",
    formulaExpression: "manual_minimum_amount",
    calculatedMinimumPayment: manualAmount,
    validationState,
    confidenceState,
    matchStatus: match.matchStatus,
    statementComparisonDelta: match.comparisonDelta,
    missingInputs: isUsableNumber(manualAmount) ? [] : ["Manual minimum amount or statement minimum due"],
  };
}

function buildInspectableVariableInputs(
  account: DebtAccount,
  values: CreditCardRuleVariableValues,
): DebtMathInspectableItem[] {
  const fields: Array<[string, number | undefined, CreditCardRuleVariable]> = [
    ["Statement balance", values.statement_balance, "statement_balance"],
    ["Current balance", values.current_balance, "current_balance"],
    ["Statement minimum entered", account.statementMinimumDue, "statement_balance"],
    ["Interest charged", values.interest_charged, "interest_charged"],
    ["Fees charged", values.fees_charged, "fees_charged"],
    ["Past due amount", values.past_due_amount, "past_due_amount"],
    ["Late fee amount", values.late_fee_amount, "late_fee_amount"],
    ["Promo balance", values.promo_balance, "promo_balance"],
    ["Regular purchase balance", values.regular_purchase_balance, "regular_purchase_balance"],
    ["Cash advance balance", values.cash_advance_balance, "cash_advance_balance"],
    ["Balance subject to minimum", values.balance_subject_to_minimum, "balance_subject_to_minimum"],
  ];

  return fields.map(([label, value]) => ({
    label,
    value: isUsableNumber(value) ? formatCurrency(value) : "Missing",
    state: isUsableNumber(value) ? "Manual" : "Limited",
    note: isUsableNumber(value) ? undefined : `${label} is not available on this account yet.`,
  }));
}

export function evaluateCreditCardPresetRule(
  presetId: CreditCardPresetRuleId,
  account: DebtAccount,
): CreditCardRulePreview {
  const preset = creditCardPresetLibrary.find((entry) => entry.id === presetId);
  if (!preset) {
    return {
      id: presetId,
      ruleName: "Unknown preset",
      plainEnglishExplanation: "Preset rule is not recognized.",
      formulaSummary: "Preset rule is missing.",
      formulaExpression: "missing_preset_rule",
      validationState: "Broken",
      confidenceState: "Limited",
      missingInputs: ["Preset rule"],
    };
  }

  const calculation = preset.compute(getVariableValues(account));
  const match = resolveMatchStatus(calculation.amount, account.statementMinimumDue);

  return {
    id: preset.id,
    ruleName: preset.ruleName,
    plainEnglishExplanation: calculation.plainEnglishExplanation,
    formulaSummary: calculation.formulaSummary,
    formulaExpression: calculation.formulaExpression,
    calculatedMinimumPayment: calculation.amount,
    validationState: calculation.validationState,
    confidenceState: calculation.confidenceState,
    matchStatus: match.matchStatus,
    statementComparisonDelta: match.comparisonDelta,
    missingInputs: calculation.missingInputs,
  };
}

export function evaluateCreditCardCustomRule(
  account: DebtAccount,
  rule: CreditCardCustomMinimumRule | undefined,
): CreditCardRulePreview {
  if (!rule) {
    return {
      id: "custom-rule",
      ruleName: "Custom rule",
      plainEnglishExplanation: "A guided custom rule has not been configured yet.",
      formulaSummary: "Custom rule is incomplete.",
      formulaExpression: "custom_rule_missing",
      validationState: "Incomplete",
      confidenceState: "Limited",
      missingInputs: ["Custom rule"],
    };
  }

  const values = getVariableValues(account);
  const missingInputs: string[] = [];
  const baseValue = requireValue(values, rule.principalVariable, missingInputs);
  const percentValue =
    typeof rule.percentageValue === "number" && rule.percentageValue >= 0
      ? normalizeAmount(rule.percentageValue)
      : undefined;
  const fixedAmount =
    typeof rule.fixedAmount === "number" && rule.fixedAmount >= 0
      ? normalizeAmount(rule.fixedAmount)
      : undefined;

  const needsPercent =
    rule.operationMode !== "Flat Only" && rule.operationMode !== "Lesser Of Flat Or Percent"
      ? true
      : rule.operationMode === "Lesser Of Flat Or Percent";
  const needsFlat =
    rule.operationMode !== "Percent Only" ? true : false;

  if (needsPercent && !isUsableNumber(percentValue)) {
    missingInputs.push("Percentage value");
  }
  if (needsFlat && !isUsableNumber(fixedAmount)) {
    missingInputs.push("Fixed amount");
  }
  if (rule.useFullBalanceBelowThreshold && !isUsableNumber(rule.thresholdAmount)) {
    missingInputs.push("Threshold amount");
  }

  if (missingInputs.length > 0) {
    return {
      id: "custom-rule",
      ruleName: rule.name || "Custom rule",
      plainEnglishExplanation: "Custom rule is missing one or more required inputs.",
      formulaSummary: "Custom rule is missing required inputs.",
      formulaExpression: "custom_rule_incomplete",
      validationState: "Missing Required Inputs",
      confidenceState: "Limited",
      missingInputs,
    };
  }

  const percentComponent = clampRoundedAmount((baseValue * (percentValue ?? 0)) / 100);
  const flatComponent = clampRoundedAmount(fixedAmount ?? 0);

  let baseAmount = 0;
  switch (rule.operationMode) {
    case "Percent Only":
      baseAmount = percentComponent;
      break;
    case "Flat Only":
      baseAmount = flatComponent;
      break;
    case "Percent Plus Flat":
      baseAmount = clampRoundedAmount(percentComponent + flatComponent);
      break;
    case "Greater Of Flat Or Percent":
      baseAmount = clampRoundedAmount(Math.max(flatComponent, percentComponent));
      break;
    case "Lesser Of Flat Or Percent":
      baseAmount = clampRoundedAmount(Math.min(flatComponent, percentComponent));
      break;
  }

  const thresholdAmount = isUsableNumber(rule.thresholdAmount)
    ? normalizeAmount(rule.thresholdAmount)
    : undefined;
  if (rule.useFullBalanceBelowThreshold && isUsableNumber(thresholdAmount) && baseValue <= thresholdAmount) {
    baseAmount = clampRoundedAmount(baseValue);
  }

  const addedComponents: Array<{ label: string; amount: number }> = [];
  if (rule.includeInterestCharged && isUsableNumber(values.interest_charged)) {
    addedComponents.push({ label: "interest", amount: values.interest_charged });
  }
  if (rule.includeFeesCharged && isUsableNumber(values.fees_charged)) {
    addedComponents.push({ label: "fees", amount: values.fees_charged });
  }
  if (rule.includePastDueAmount && isUsableNumber(values.past_due_amount)) {
    addedComponents.push({ label: "past due", amount: values.past_due_amount });
  }
  if (rule.includeLateFeeAmount && isUsableNumber(values.late_fee_amount)) {
    addedComponents.push({ label: "late fee", amount: values.late_fee_amount });
  }
  if (rule.includePromoBalance && isUsableNumber(values.promo_balance)) {
    addedComponents.push({ label: "promo", amount: values.promo_balance });
  }
  if (rule.includeRegularPurchaseBalance && isUsableNumber(values.regular_purchase_balance)) {
    addedComponents.push({
      label: "regular purchase balance",
      amount: values.regular_purchase_balance,
    });
  }
  if (rule.includeCashAdvanceBalance && isUsableNumber(values.cash_advance_balance)) {
    addedComponents.push({ label: "cash advance balance", amount: values.cash_advance_balance });
  }

  const totalAmount = clampRoundedAmount(
    baseAmount + addedComponents.reduce((sum, item) => sum + item.amount, 0),
  );
  const formulaExpressionParts = [
    `${getValueLabel(rule.principalVariable).toLowerCase().replaceAll(" ", "_")}`,
  ];

  if (rule.operationMode !== "Flat Only") {
    formulaExpressionParts.push(`* ${normalizeAmount(percentValue ?? 0)}%`);
  }
  if (rule.operationMode !== "Percent Only" && isUsableNumber(fixedAmount)) {
    formulaExpressionParts.push(`flat ${formatCurrency(flatComponent)}`);
  }
  for (const component of addedComponents) {
    formulaExpressionParts.push(`+ ${component.label}`);
  }

  const formulaSummary = [
    `${rule.operationMode} on ${getValueLabel(rule.principalVariable).toLowerCase()}`,
    isUsableNumber(percentValue) ? `${normalizeAmount(percentValue).toFixed(2)}%` : undefined,
    isUsableNumber(fixedAmount) ? `${formatCurrency(flatComponent)} floor` : undefined,
    rule.useFullBalanceBelowThreshold && isUsableNumber(thresholdAmount)
      ? `full balance if below ${formatCurrency(thresholdAmount)}`
      : undefined,
    addedComponents.length > 0 ? `plus ${addedComponents.map((item) => item.label).join(", ")}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const match = resolveMatchStatus(totalAmount, account.statementMinimumDue);

  return {
    id: "custom-rule",
    ruleName: rule.name || "Custom rule",
    plainEnglishExplanation:
      "Guided custom rule using the selected balance base, operation mode, and included components.",
    formulaSummary,
    formulaExpression: formulaExpressionParts.join(" "),
    calculatedMinimumPayment: totalAmount,
    validationState: "Valid",
    confidenceState: "Custom",
    matchStatus: match.matchStatus,
    statementComparisonDelta: match.comparisonDelta,
    missingInputs: [],
  };
}

function getPaymentAssumptionAmount(
  account: DebtAccount,
  currentMinimumPayment: number | undefined,
  currentMinimumTrustState: DebtMathTrustState,
): {
  amount?: number;
  trustState: DebtMathTrustState;
} {
  const mode: CreditCardPaymentAssumptionMode = account.paymentAssumptionMode ?? "Minimum Due";

  switch (mode) {
    case "Statement Balance":
      return {
        amount: account.statementBalance,
        trustState: isUsableNumber(account.statementBalance) ? "Manual" : "Limited",
      };
    case "Total Balance":
      return {
        amount: account.currentBalance,
        trustState: "Manual",
      };
    case "Custom Amount":
      return {
        amount: account.paymentAssumptionCustomAmount,
        trustState:
          isUsableNumber(account.paymentAssumptionCustomAmount) &&
          account.paymentAssumptionCustomAmount > 0
            ? "Custom"
            : "Limited",
      };
    case "Minimum Due":
    default:
      return {
        amount: currentMinimumPayment,
        trustState: isUsableNumber(currentMinimumPayment)
          ? currentMinimumTrustState
          : "Limited",
      };
  }
}

export function buildCreditCardMinimumSystem(account: DebtAccount): CreditCardMinimumSystem {
  const minimumPaymentMode: CreditCardMinimumPaymentMode =
    account.minimumPaymentMode ?? "Manual Minimum Amount";
  const selectedPresetPreview = account.minimumPaymentPresetId
    ? evaluateCreditCardPresetRule(account.minimumPaymentPresetId, account)
    : undefined;
  const presetLibrary = creditCardPresetLibrary.map((preset) =>
    evaluateCreditCardPresetRule(preset.id, account),
  );
  const customRulePreview = evaluateCreditCardCustomRule(
    account,
    account.minimumPaymentCustomRule,
  );
  const manualPreview = buildManualMinimumPreview(account);

  const activePreview =
    minimumPaymentMode === "Preset Rule"
      ? selectedPresetPreview ??
        {
          id: "missing-preset",
          ruleName: "Preset rule",
          plainEnglishExplanation: "Select a preset rule to calculate the current minimum.",
          formulaSummary: "Preset rule is not selected yet.",
          formulaExpression: "preset_rule_missing",
          validationState: "Incomplete" as CreditCardRuleValidationState,
          confidenceState: "Limited" as DebtMathTrustState,
          missingInputs: ["Preset rule"],
        }
      : minimumPaymentMode === "Custom Rule"
        ? customRulePreview
        : manualPreview;

  const paymentAssumption = getPaymentAssumptionAmount(
    account,
    activePreview.calculatedMinimumPayment,
    activePreview.confidenceState,
  );
  const formulaInputs = buildInspectableVariableInputs(account, getVariableValues(account));
  const missingDataWarnings = [
    ...activePreview.missingInputs.map((item) => `${item} is missing for the active rule.`),
    ...formulaInputs
      .filter((input) => input.state === "Limited")
      .map((input) => `${input.label} is missing on this account.`),
  ].filter((warning, index, array) => array.indexOf(warning) === index);

  return {
    issuerDisplayName: account.issuerName?.trim() || account.providerName.trim(),
    accountIdentity: account.providerName.trim(),
    currentMinimumPayment: activePreview.calculatedMinimumPayment,
    currentMinimumPaymentTrustState: activePreview.confidenceState,
    minimumPaymentMode,
    paymentAssumptionMode: account.paymentAssumptionMode ?? "Minimum Due",
    paymentAssumptionAmount: paymentAssumption.amount,
    paymentAssumptionTrustState: paymentAssumption.trustState,
    activeRuleName: activePreview.ruleName,
    activeRuleExplanation: activePreview.plainEnglishExplanation,
    activeFormulaSummary: activePreview.formulaSummary,
    activeFormulaExpression: activePreview.formulaExpression,
    validationState: activePreview.validationState,
    confidenceState: activePreview.confidenceState,
    lastVerifiedAgainstStatement: account.lastVerifiedAgainstStatement,
    statementMinimumLastEntered: account.statementMinimumDue,
    statementMatchStatus: activePreview.matchStatus,
    statementComparisonDelta: activePreview.statementComparisonDelta,
    currentFormulaInputs: formulaInputs,
    missingDataWarnings,
    presetLibrary,
    selectedPresetPreview,
    customRulePreview,
  };
}
